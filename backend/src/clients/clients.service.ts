import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { CreateClientDto, UpdateClientDto, ClientListQuery, ClientRepresentativeInput } from './dto/client.dto';
import { CreateRepresentativeDto, UpdateRepresentativeDto } from './dto/representative.dto';
const include = { representatives: { where: { validTo: null }, orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'desc' as const }, { id: 'asc' as const }] }, _count: { select: { contracts: true } } };
@Injectable()
export class ClientsService {
 constructor(private readonly prisma: PrismaService, private readonly audit: AuditLogService) {}
 findAll(organizationId: string) { return this.prisma.client.findMany({ where: { organizationId, deletedAt: null }, include, orderBy: [{ legalName: 'asc' }, { id: 'asc' }] }); }
 async listPage(organizationId: string, query: ClientListQuery) {
  const search = query.search?.trim();
  const where: Prisma.ClientWhereInput = { organizationId, deletedAt: null, ...(search ? { OR: [
   { legalName: { contains: search, mode: 'insensitive' } }, { taxId: { contains: search, mode: 'insensitive' } },
   { representatives: { some: { validTo: null, fullName: { contains: search, mode: 'insensitive' } } } },
  ] } : {}) };
  return this.prisma.$transaction(async tx => {
   const total = await tx.client.count({ where }); const pageSize = query.pageSize ?? 5;
   const page = Math.min(query.page ?? 1, Math.max(1, Math.ceil(total / pageSize)));
   const items = await tx.client.findMany({ where, include, orderBy: [{ legalName: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize });
   return { items, total, page, pageSize };
  });
 }
 async findOne(organizationId: string, id: string) {
  const item = await this.prisma.client.findFirst({ where: { id, organizationId, deletedAt: null }, include });
  if (!item) throw new NotFoundException('Cliente no encontrado.'); return item;
 }
 private duplicate(error: unknown): never {
  if ((error as { code?: string }).code === 'P2002') throw new ConflictException('Ya existe un cliente con este RUC.');
  throw error;
 }
 private async saveRepresentative(tx: Prisma.TransactionClient, clientId: string, dto: ClientRepresentativeInput) {
  const { id, ...values } = dto;
  const current = id ? await tx.clientRepresentative.findFirst({ where: { id, clientId, validTo: null } }) :
   await tx.clientRepresentative.findFirst({ where: { clientId, validTo: null }, orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }] });
  if (id && !current) throw new NotFoundException('Representante no encontrado para este cliente.');
  await tx.clientRepresentative.updateMany({ where: { clientId, isPrimary: true, validTo: null }, data: { isPrimary: false } });
  return current ? tx.clientRepresentative.update({ where: { id: current.id }, data: { ...values, isPrimary: true } }) :
   tx.clientRepresentative.create({ data: { ...values, clientId, isPrimary: true } });
 }
  async create(organizationId: string, dto: CreateClientDto) {
   const { representative, ...company } = dto;
   if (!representative) throw new BadRequestException('El representante legal es obligatorio.');
   if (representative?.id) throw new BadRequestException('Un representante nuevo no debe incluir un identificador.');
   try { return await this.prisma.$transaction(async tx => {
    const client = await tx.client.create({ data: { ...company, organizationId, country: (company.country ?? 'EC').toUpperCase() } });
   if (representative) await this.saveRepresentative(tx, client.id, representative);
    await tx.auditLog.create({ data: { organizationId, action: 'CLIENT_CREATED', entityType: 'Client', entityId: client.id, after: { legalName: client.legalName, taxId: client.taxId, ...(representative ? { representative: `${representative.treatment} ${representative.fullName}` } : {}) } } });
   return tx.client.findUniqueOrThrow({ where: { id: client.id }, include });
  }); } catch (error) { this.duplicate(error); }
 }
 async update(organizationId: string, id: string, dto: UpdateClientDto) {
  const { representative, ...company } = dto;
  try { return await this.prisma.$transaction(async tx => {
   const current = await tx.client.findFirst({ where: { id, organizationId, deletedAt: null } });
   if (!current) throw new NotFoundException('Cliente no encontrado.');
   const item = await tx.client.update({ where: { id }, data: { ...company, country: company.country?.toUpperCase() } });
   if (representative) await this.saveRepresentative(tx, id, representative);
    await tx.auditLog.create({ data: { organizationId, action: 'CLIENT_UPDATED', entityType: 'Client', entityId: id, before: { legalName: current.legalName, taxId: current.taxId }, after: { legalName: item.legalName, taxId: item.taxId, ...(representative ? { representative: `${representative.treatment} ${representative.fullName}` } : {}) } } });
   return tx.client.findUniqueOrThrow({ where: { id }, include });
  }); } catch (error) { this.duplicate(error); }
 }
 async remove(organizationId: string, id: string) {
  return this.prisma.$transaction(async tx => {
   const current = await tx.client.findFirst({ where: { id, organizationId, deletedAt: null }, select: { id: true, legalName: true, taxId: true, _count: { select: { contracts: true } } } });
   if (!current) throw new NotFoundException('Cliente no encontrado.');
   const deletedAt = new Date();
   const updated = await tx.client.updateMany({ where: { id, organizationId, deletedAt: null }, data: { deletedAt } });
   if (updated.count !== 1) throw new NotFoundException('Cliente no encontrado.');
   await tx.auditLog.create({ data: { organizationId, action: 'CLIENT_DELETED', entityType: 'Client', entityId: id, before: { legalName: current.legalName, taxId: current.taxId, contractCount: current._count.contracts }, after: { deletedAt: deletedAt.toISOString() } } });
   return { id, deletedAt, contractCount: current._count.contracts };
  });
 }
  representatives(clientId: string) { return this.prisma.clientRepresentative.findMany({ where: { clientId }, orderBy: [{ isPrimary: 'desc' }, { fullName: 'asc' }] }); }
  async createRepresentative(organizationId: string, clientId: string, dto: CreateRepresentativeDto) { await this.findOne(organizationId, clientId); return this.prisma.$transaction(async (tx) => { if (dto.isPrimary) await tx.clientRepresentative.updateMany({ where: { clientId, isPrimary: true, validTo: null }, data: { isPrimary: false } }); const item = await tx.clientRepresentative.create({ data: { ...dto, clientId } }); await tx.auditLog.create({ data: { organizationId, action: 'REPRESENTATIVE_CREATED', entityType: 'ClientRepresentative', entityId: item.id, after: { fullName: item.fullName, isPrimary: item.isPrimary } } }); return item; }); }
  async updateRepresentative(organizationId: string, clientId: string, representativeId: string, dto: UpdateRepresentativeDto) { await this.findOne(organizationId, clientId); const existing = await this.prisma.clientRepresentative.findFirst({ where: { id: representativeId, clientId } }); if (!existing) throw new NotFoundException('Representative not found'); return this.prisma.$transaction(async (tx) => { if (dto.isPrimary) await tx.clientRepresentative.updateMany({ where: { clientId, isPrimary: true, id: { not: representativeId }, validTo: null }, data: { isPrimary: false } }); const item = await tx.clientRepresentative.update({ where: { id: representativeId }, data: dto }); await tx.auditLog.create({ data: { organizationId, action: 'REPRESENTATIVE_UPDATED', entityType: 'ClientRepresentative', entityId: item.id, before: { isPrimary: existing.isPrimary }, after: { isPrimary: item.isPrimary } } }); return item; }); }
}

