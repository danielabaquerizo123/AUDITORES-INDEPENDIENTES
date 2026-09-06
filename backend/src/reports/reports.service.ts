import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class ReportsService {
 constructor(private readonly prisma: PrismaService) {}
 async list(organizationId:string) {
  const periods=await this.prisma.auditPeriod.findMany({where:{client:{organizationId}},include:{client:true,financialImports:{orderBy:{createdAt:'desc'},take:1},generatedDocuments:{where:{type:'AUDIT_REPORT_WORKING'},orderBy:{createdAt:'desc'},take:1}},orderBy:{fiscalYear:'desc'}});
  return periods.map(p=>({clientId:p.clientId,auditPeriodId:p.id,client:{id:p.client.id,legalName:p.client.legalName,taxId:p.client.taxId},fiscalYear:p.fiscalYear,financialImport:p.financialImports[0]?{id:p.financialImports[0].id,status:p.financialImports[0].status}:null,report:p.generatedDocuments[0]??null}));
 }
 async prepare(organizationId:string,userId:string,periodId:string) {
  const period=await this.prisma.auditPeriod.findFirst({where:{id:periodId,client:{organizationId}},include:{financialImports:{where:{status:{in:['PROCESSED','REVIEW_REQUIRED']}},orderBy:{createdAt:'desc'},take:1},generatedDocuments:{where:{type:'AUDIT_REPORT_WORKING'},take:1}}});
  if(!period) throw new NotFoundException('Período auditado no encontrado.');
  if(!period.financialImports[0]) throw new ConflictException('Importe primero los estados financieros.');
  if(period.generatedDocuments[0]) return period.generatedDocuments[0];
  return this.prisma.generatedDocument.create({data:{auditPeriodId:period.id,generatedById:userId,type:'AUDIT_REPORT_WORKING',status:'DRAFT',title:'Informe de Auditoría',variablesSnapshot:{financialImportId:period.financialImports[0].id,clientId:period.clientId,fiscalYear:period.fiscalYear}}});
 }
}
