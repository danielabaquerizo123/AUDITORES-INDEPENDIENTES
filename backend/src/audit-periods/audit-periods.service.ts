import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateAuditPeriodDto, UpdateAuditPeriodDto } from './dto/audit-period.dto';
@Injectable() export class AuditPeriodsService {
 constructor(private readonly prisma: PrismaService) {}
 list(org:string,clientId: string) { return this.prisma.auditPeriod.findMany({ where:{clientId,client:{organizationId:org}}, orderBy:{fiscalYear:'desc'} }); }
 async one(org:string,id:string) { const item=await this.prisma.auditPeriod.findFirst({where:{id,client:{organizationId:org}},include:{client:true}}); if(!item) throw new NotFoundException('Audit period not found'); return item; }
 async create(org:string,clientId:string,dto:CreateAuditPeriodDto) { await this.prisma.client.findFirstOrThrow({where:{id:clientId,organizationId:org}}).catch(()=>{throw new NotFoundException('Client not found')}); if(dto.startDate>=dto.endDate || dto.fiscalYear < dto.startDate.getFullYear() || dto.fiscalYear > dto.endDate.getFullYear()) throw new BadRequestException('Invalid audit period dates'); try{return await this.prisma.auditPeriod.create({data:{...dto,clientId}})}catch(e){if((e as {code?:string}).code==='P2002')throw new ConflictException('Fiscal year already exists for this client');throw e} }
 async update(org:string,id:string,dto:UpdateAuditPeriodDto) { const current=await this.one(org,id); const start=dto.startDate??current.startDate,end=dto.endDate??current.endDate; if(start>=end)throw new BadRequestException('startDate must be before endDate'); return this.prisma.auditPeriod.update({where:{id},data:dto}); }
}
