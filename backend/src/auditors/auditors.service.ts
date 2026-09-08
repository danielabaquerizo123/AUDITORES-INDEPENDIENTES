import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PrismaService } from '../database/prisma.service';
import { AuditorListQuery, CreateAuditorDto, UpdateAuditorDto } from './dto/auditor.dto';

@Injectable()
export class AuditorsService {
 constructor(private readonly prisma:PrismaService,private readonly audit:AuditLogService){}
 private where(organizationId:string,search?:string):Prisma.AuditorWhereInput { const value=search?.trim(); return {organizationId,deletedAt:null,...(value?{OR:[{fullName:{contains:value,mode:'insensitive'}},{cedula:{contains:value}},{ruc:{contains:value}},{externalAuditorRegistration:{contains:value,mode:'insensitive'}}]}:{})}; }
 async list(organizationId:string,query:AuditorListQuery) { const where=this.where(organizationId,query.search); return this.prisma.$transaction(async tx=>{const total=await tx.auditor.count({where});const pageSize=query.pageSize??5;const page=Math.min(query.page??1,Math.max(1,Math.ceil(total/pageSize)));const items=await tx.auditor.findMany({where,orderBy:[{fullName:'asc'},{id:'asc'}],skip:(page-1)*pageSize,take:pageSize});return {items,total,page,pageSize};}); }
 async one(organizationId:string,id:string){const item=await this.prisma.auditor.findFirst({where:{id,organizationId,deletedAt:null}});if(!item)throw new NotFoundException('Auditor no encontrado.');return item;}
 private duplicate(error:unknown):never { if((error as {code?:string;meta?:{target?:string[]}}).code==='P2002'){const target=(error as {meta?:{target?:string[]}}).meta?.target?.join(' ')??'';if(target.includes('ruc'))throw new ConflictException('Ya existe un auditor registrado con este RUC.');if(target.includes('cedula'))throw new ConflictException('Ya existe un auditor registrado con esta cédula.');throw new ConflictException('Ya existe un auditor registrado con este Registro Nacional de Auditor Externo.');}throw error; }
 async create(organizationId:string,dto:CreateAuditorDto){try{const item=await this.prisma.auditor.create({data:{...dto,organizationId}});await this.audit.record({organizationId,action:'AUDITOR_CREATED',entityType:'Auditor',entityId:item.id,after:{fullName:item.fullName,ruc:item.ruc}});return item;}catch(error){this.duplicate(error);}}
 async update(organizationId:string,id:string,dto:UpdateAuditorDto){await this.one(organizationId,id);try{const item=await this.prisma.auditor.update({where:{id},data:dto});await this.audit.record({organizationId,action:'AUDITOR_UPDATED',entityType:'Auditor',entityId:id,after:{fullName:item.fullName,ruc:item.ruc}});return item;}catch(error){this.duplicate(error);}}
 async remove(organizationId:string,id:string){const current=await this.one(organizationId,id);const deletedAt=new Date();await this.prisma.auditor.update({where:{id},data:{deletedAt,isActive:false}});await this.audit.record({organizationId,action:'AUDITOR_DELETED',entityType:'Auditor',entityId:id,before:{fullName:current.fullName,ruc:current.ruc},after:{deletedAt:deletedAt.toISOString()}});return {id,deletedAt};}
}
