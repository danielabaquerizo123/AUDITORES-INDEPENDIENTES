import { OfficialContractDocument } from './documents/official-contract-document';

import { PrepareOfficialContractDto } from './dto/contracts.dto';

import { BadRequestException, ConflictException, Injectable, NotFoundException, StreamableFile } from '@nestjs/common';

import { Prisma } from '@prisma/client';

import { createHash } from 'crypto';

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

import { join } from 'path';

import { PrismaService } from '../database/prisma.service';

import { AuditLogService } from '../audit-log/audit-log.service';

import { ContractContextBuilder } from './variables/contract-context.builder';

import { ContractVariablesValidator } from './variables/contract-variables.validator';

import { ContractTemplateRenderer } from './variables/contract-template.renderer';

import {

  ContractDocumentBuilder,

  buildPublicFileName,

  buildSafeFileName,

  resolveGeneratedDir,

  type GeneratedFormat,

} from './documents/contract-document.builder';

import { CreateContractDto, CreateTemplateDto, UpdateContractDto } from './dto/contracts.dto';



const MIME_TYPES: Record<GeneratedFormat, string> = {

  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

  pdf: 'application/pdf',

};



const DOCUMENT_TYPES: Record<GeneratedFormat, string> = {

  docx: 'CONTRACT_DOCX',

  pdf: 'CONTRACT_PDF',

};



function toSafeDocument(row: {

  id: string;

  contractId: string | null;

  auditPeriodId: string;

  type: string;

  status: unknown;

  title: string;

  originalFileName: string | null;

  mimeType: string | null;

  sizeBytes: bigint | number | null;

  sha256: string | null;

  templateVersion: string | null;

  generatedAt: Date | null;

  createdAt: Date;

}) {

  return {

    id: row.id,

    contractId: row.contractId,

    auditPeriodId: row.auditPeriodId,

    type: row.type,

    status: row.status,

    title: row.title,

    originalFileName: row.originalFileName,

    mimeType: row.mimeType,

    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),

    sha256: row.sha256,

    templateVersion: row.templateVersion,

    generatedAt: row.generatedAt,

    createdAt: row.createdAt,

  };

}



type OfficialContractItem = Prisma.ContractGetPayload<{

  include: { clauses: true; client: true; auditPeriod: true; template: true };

}>;



@Injectable()

export class ContractsService {

  constructor(

    private readonly prisma: PrismaService,

    private readonly official: OfficialContractDocument,

    private readonly builder: ContractContextBuilder,

    private readonly validator: ContractVariablesValidator,

    private readonly renderer: ContractTemplateRenderer,

    private readonly documentBuilder: ContractDocumentBuilder,

    private readonly audit: AuditLogService,

  ) {}



  templates(org: string) {

    return this.prisma.contractTemplate.findMany({

      where: { organizationId: org },

      include: { clauses: true },

      orderBy: { name: 'asc' },

    });

  }



  async template(org: string, id: string) {

    const found = await this.prisma.contractTemplate.findFirst({

      where: { id, organizationId: org },

      include: { clauses: { orderBy: { sortOrder: 'asc' } } },

    });

    if (!found) throw new NotFoundException('Template not found');

    return found;

  }



  async createTemplate(org: string, dto: CreateTemplateDto) {

    const max = await this.prisma.contractTemplate.aggregate({

      where: { organizationId: org, name: dto.name },

      _max: { version: true },

    });

    return this.prisma.contractTemplate.create({

      data: {

        organizationId: org,

        name: dto.name,

        version: (max._max.version ?? 0) + 1,

        description: dto.description,

        clauses: { create: dto.clauses },

      },

      include: { clauses: true },

    });

  }



  async createContract(org: string, userId: string, periodId: string, dto: CreateContractDto) {

    const period = await this.prisma.auditPeriod.findFirst({

      where: { id: periodId, client: { organizationId: org } },

      include: { client: true },

    });

    if (!period) throw new NotFoundException('Audit period not found');

    const template = await this.template(org, dto.templateId);

    try {

      const created = await this.prisma.$transaction(async (tx) => {

        const item = await tx.contract.create({

          data: {

            clientId: period.clientId,

            auditPeriodId: periodId,

            templateId: template.id,

            createdById: userId,

            updatedById: userId,

            contractNumber: dto.contractNumber,

            signingDate: dto.signingDate,

            effectiveFrom: dto.effectiveFrom,

            effectiveTo: dto.effectiveTo,

            reportDeliveryDate: dto.reportDeliveryDate,

            taxReportDeliveryDate: dto.taxReportDeliveryDate,

            informationDeliveryDate: dto.informationDeliveryDate,

            draftReportDueDate: dto.draftReportDueDate,

            feeNet: dto.feeNet ? new Prisma.Decimal(dto.feeNet) : undefined,

            currency: dto.currency ?? 'USD',

            notes: dto.notes,

            clauses: {

              create: template.clauses

                .filter((clause) => clause.active)

                .map((clause) => ({

                  clauseKey: clause.clauseKey,

                  title: clause.title,

                  body: clause.body,

                  sortOrder: clause.sortOrder,

                  enabled: true,

                  sourceTemplateClauseId: clause.id,

                })),

            },

          },

          include: { clauses: true },

        });

        return item;

      });

      await this.audit.record({

        organizationId: org,

        actorUserId: userId,

        action: 'CONTRACT_CREATED',

        entityType: 'Contract',

        entityId: created.id,

        auditPeriodId: periodId,

        after: { templateId: template.id, contractNumber: created.contractNumber },

      });

      return created;

    } catch (error) {

      if ((error as { code?: string }).code === 'P2002') {

        throw new ConflictException('A contract already exists for this audit period');

      }

      throw error;

    }

  }



  async updateContract(org: string, userId: string, id: string, dto: UpdateContractDto) {

    const current = await this.one(org, id);

    if (this.official.isOfficial(current.variables)) {

      if (!dto.sections || !dto.expectedUpdatedAt) throw new BadRequestException('Envíe las secciones y la versión revisada del contrato.');

      const allowed = new Set(current.clauses.map(c=>c.clauseKey));

      if (dto.sections.length !== allowed.size || new Set(dto.sections.map(c=>c.clauseKey)).size !== allowed.size || dto.sections.some(c=>!allowed.has(c.clauseKey))) throw new BadRequestException('Las secciones no coinciden con la plantilla.');

      await this.prisma.$transaction(async tx=>{

        const lock = await tx.contract.updateMany({where:{id,updatedAt:new Date(dto.expectedUpdatedAt!)},data:{updatedById:userId,updatedAt:new Date()}});

        if (lock.count!==1) throw new ConflictException('El contrato cambió en otra sesión. Recargue antes de guardar.');

        for(const section of dto.sections!) await tx.contractClause.update({where:{contractId_clauseKey:{contractId:id,clauseKey:section.clauseKey}},data:{body:section.body}});

      });

      await this.audit.record({organizationId:org,actorUserId:userId,action:'CONTRACT_UPDATED',entityType:'Contract',entityId:id,auditPeriodId:current.auditPeriodId,after:{sections:dto.sections.length}});

      return this.one(org,id);

    }

    if (dto.sections) throw new BadRequestException('Este contrato anterior no está vinculado a la plantilla oficial.');

    const updated = await this.prisma.contract.update({

      where: { id },

      data: {

        contractNumber: dto.contractNumber,

        signingDate: dto.signingDate,

        effectiveFrom: dto.effectiveFrom,

        effectiveTo: dto.effectiveTo,

        reportDeliveryDate: dto.reportDeliveryDate,

        taxReportDeliveryDate: dto.taxReportDeliveryDate,

        informationDeliveryDate: dto.informationDeliveryDate,

        draftReportDueDate: dto.draftReportDueDate,

        feeNet: dto.feeNet ? new Prisma.Decimal(dto.feeNet) : undefined,

        currency: dto.currency,

        notes: dto.notes,

        status: dto.status,

        updatedById: userId,

      },

      include: { clauses: { orderBy: { sortOrder: 'asc' } } },

    });

    await this.audit.record({

      organizationId: org,

      actorUserId: userId,

      action: 'CONTRACT_UPDATED',

      entityType: 'Contract',

      entityId: id,

      auditPeriodId: current.auditPeriodId,

      before: { status: current.status, feeNet: current.feeNet?.toString() ?? null },

      after: { status: updated.status, feeNet: updated.feeNet?.toString() ?? null },

    });

    return updated;

  }



  async contractByPeriod(org: string, periodId: string) {

    const contract = await this.prisma.contract.findFirst({

      where: { auditPeriodId: periodId, client: { organizationId: org } },

      include: {

        clauses: { orderBy: { sortOrder: 'asc' } },

        template: true,

        client: true,

        auditPeriod: true,

      },

    });

    if (!contract) throw new NotFoundException('Contract not found');

    return contract;

  }



  private async loadContextData(orgId: string, id: string) {

    const item = await this.prisma.contract.findFirst({

      where: { id, client: { organizationId: orgId } },

      include: {

        client: {

          include: { representatives: { where: { isPrimary: true, validTo: null }, take: 1 } },

        },

        auditPeriod: true,

        template: true,

      },

    });

    if (!item) throw new NotFoundException('Contract not found');

    const organization = await this.prisma.organization.findUnique({ where: { id: orgId } });

    if (!organization) throw new NotFoundException('Organization not found');

    return item;

  }



  async context(orgId: string, id: string) {

    const item = await this.loadContextData(orgId, id);

    const organization = await this.prisma.organization.findUnique({ where: { id: orgId } });

    if (!organization) throw new NotFoundException('Organization not found');

    return this.builder.build({

      contract: item,

      client: item.client,

      representative: item.client.representatives[0] ?? null,

      period: item.auditPeriod,

      organization,

    });

  }



  async validate(org: string, id: string) {

    const result = await this.context(org, id);

    const clauses = await this.prisma.contractClause.findMany({

      where: { contractId: id, enabled: true },

      orderBy: { sortOrder: 'asc' },

    });

    return this.validator.validate(

      result.context,

      clauses.map((clause) => clause.body),

    );

  }



  async preview(org: string, id: string) {

    const item = await this.loadContextData(org, id);

    if (this.official.isOfficial(item.variables)) {

      const current = await this.one(org,id);

      return {contract:current,sections:current.clauses,validation:{valid:true,errors:[],warnings:[],missing:[],unknown:[]}};

    }

    const built = await this.context(org, id);

    const clauses = await this.prisma.contractClause.findMany({

      where: { contractId: id, enabled: true },

      orderBy: { sortOrder: 'asc' },

    });

    const validation = this.validator.validate(

      built.context,

      clauses.map((clause) => clause.body),

    );

    const sections = this.renderer.renderClauses(clauses, built.context);

    return {

      contract: {

        id: item.id,

        contractNumber: item.contractNumber,

        status: item.status,

        signingDate: item.signingDate,

        effectiveFrom: item.effectiveFrom,

        effectiveTo: item.effectiveTo,

        reportDeliveryDate: item.reportDeliveryDate,

        taxReportDeliveryDate: item.taxReportDeliveryDate,

        informationDeliveryDate: item.informationDeliveryDate,

        draftReportDueDate: item.draftReportDueDate,

        feeNet: item.feeNet?.toString() ?? null,

        feeWords: (built.context.contract as Record<string, unknown>)?.feeWords ?? null,

        currency: item.currency,

        notes: item.notes,

        template: item.template

          ? { id: item.template.id, name: item.template.name, version: item.template.version }

          : null,

        client: { id: item.client.id, legalName: item.client.legalName, taxId: item.client.taxId },

        auditPeriod: {

          id: item.auditPeriod.id,

          label: item.auditPeriod.label,

          fiscalYear: item.auditPeriod.fiscalYear,

        },

      },

      sections,

      validation,

    };

  }



  async generate(org: string, userId: string, id: string, format: GeneratedFormat) {

    return this.generateContractDocument(org, userId, id, format);

  }



  /**

   * Núcleo reutilizable de generación contractual (Fase 4).

   * Tanto la generación individual como la masiva terminan aquí:

   * DB → Contract → ContextBuilder → Validator → Renderer → DOCX/PDF →

   * GeneratedDocument + AuditLog. No existe otro motor.

   */

  async generateContractDocument(org: string, userId: string, id: string, format: GeneratedFormat) {

    const item = await this.loadContextData(org, id);

    if (this.official.isOfficial(item.variables)) return this.generateOfficial(org,userId,id,format);

    const validation = await this.validate(org, id);

    if (!validation.valid) {

      throw new BadRequestException({ message: validation.errors });

    }

    const built = await this.context(org, id);

    const clauses = await this.prisma.contractClause.findMany({

      where: { contractId: id, enabled: true },

      orderBy: { sortOrder: 'asc' },

    });

    const sections = this.renderer.renderClauses(clauses, built.context);

    const clientName = item.client.legalName;

    const year = item.auditPeriod.fiscalYear;

    const signatories = [

      ...(built.context.representative &&

      typeof built.context.representative === 'object' &&

      (built.context.representative as Record<string, unknown>).name

        ? [`${String((built.context.representative as Record<string, unknown>).name)} — Representante legal`]

        : []),

      `Auditoría — ${year}`,

    ];

    const buffer =

      format === 'docx'

        ? await this.documentBuilder.buildDocx({

            title: `Contrato de auditoría ${year} — ${clientName}`,

            subtitle: `Período: ${item.auditPeriod.label}`,

            sections,

            signatories,

          })

        : await this.documentBuilder.buildPdf({

            title: `Contrato de auditoria ${year} - ${clientName}`,

            subtitle: `Periodo: ${item.auditPeriod.label}`,

            sections,

            signatories,

          });



    const dir = resolveGeneratedDir();

    const fileName = buildSafeFileName(id, format);

    writeFileSync(join(dir, fileName), buffer);

    const sha256 = createHash('sha256').update(buffer).digest('hex');

    const snapshot = JSON.parse(JSON.stringify(built.context)) as Prisma.InputJsonValue;



    const record = await this.prisma.generatedDocument.create({

      data: {

        auditPeriodId: item.auditPeriodId,

        contractId: id,

        generatedById: userId,

        type: DOCUMENT_TYPES[format],

        status: 'GENERATED',

        title: `Contrato ${year} — ${clientName}`,

        storageKey: fileName,

        originalFileName: `contrato-${year}.${format}`,

        mimeType: MIME_TYPES[format],

        sizeBytes: BigInt(buffer.length),

        sha256,

        templateVersion: item.template ? String(item.template.version) : null,

        variablesSnapshot: snapshot,

        generatedAt: new Date(),

      },

    });

    await this.audit.record({

      organizationId: org,

      actorUserId: userId,

      action: format === 'docx' ? 'CONTRACT_DOCX_GENERATED' : 'CONTRACT_PDF_GENERATED',

      entityType: 'GeneratedDocument',

      entityId: record.id,

      auditPeriodId: item.auditPeriodId,

      after: { contractId: id, type: record.type, sha256 },

    });

    return toSafeDocument(record);

  }



  async documents(org: string, id: string) {

    const item = await this.one(org, id);

    const rows = await this.prisma.generatedDocument.findMany({

      where: { contractId: item.id },

      orderBy: { createdAt: 'desc' },

    });

    return rows.map(toSafeDocument);

  }



  async download(org: string, userId: string, id: string, docId: string) {

    const item = await this.one(org, id);

    const record = await this.prisma.generatedDocument.findFirst({

      where: { id: docId, contractId: item.id },

    });

    if (!record || !record.storageKey) throw new NotFoundException('Document not found');

    const dir = resolveGeneratedDir();

    const absolute = join(dir, record.storageKey);

    if (!absolute.startsWith(dir) || !existsSync(absolute)) {

      throw new NotFoundException('Document file not found');

    }

    await this.audit.record({

      organizationId: org,

      actorUserId: userId,

      action: 'CONTRACT_DOCUMENT_DOWNLOADED',

      entityType: 'GeneratedDocument',

      entityId: record.id,

      auditPeriodId: item.auditPeriodId,

    });

    return {

      stream: new StreamableFile(readFileSync(absolute)),

      mimeType: record.mimeType ?? 'application/octet-stream',

      fileName: record.originalFileName ?? record.storageKey,

      size: Number(record.sizeBytes ?? 0),

    };

  }



  async prepareOfficial(org:string,userId:string,dto:PrepareOfficialContractDto) {

    const client=await this.prisma.client.findFirst({where:{id:dto.clientId,organizationId:org,deletedAt:null},include:{representatives:{where:{validTo:null},orderBy:[{isPrimary:'desc'},{createdAt:'desc'}],take:1}}});

    if(!client)throw new NotFoundException('Cliente no encontrado');

    const rep=client.representatives[0];

    if(!rep?.nationalId||!rep.position||!client.economicActivity)throw new BadRequestException('Complete la actividad económica y los datos del representante legal en Clientes.');

    const snapshot=this.official.snapshot({COMPANY_NAME:client.legalName,COMPANY_RUC:client.taxId,COMPANY_ACTIVITY:client.economicActivity,COMPANY_EMAIL:client.email??'',REPRESENTATIVE_TITLE:rep.treatment,REPRESENTATIVE_NAME:rep.fullName,REPRESENTATIVE_ID:rep.nationalId,REPRESENTATIVE_POSITION:rep.position,AUDITED_YEAR:String(dto.auditedYear)});

    const sections=this.official.sections(snapshot);

    try {

      const result=await this.prisma.$transaction(async tx=>{

        const period=await tx.auditPeriod.upsert({where:{clientId_fiscalYear:{clientId:client.id,fiscalYear:dto.auditedYear}},update:{},create:{clientId:client.id,fiscalYear:dto.auditedYear,label:String(dto.auditedYear),startDate:new Date(Date.UTC(dto.auditedYear,0,1)),endDate:new Date(Date.UTC(dto.auditedYear,11,31))}});

        return tx.contract.create({data:{clientId:client.id,auditPeriodId:period.id,createdById:userId,updatedById:userId,variables:JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue,clauses:{create:sections}},include:{clauses:true,client:true,auditPeriod:true}});

      });

      await this.audit.record({organizationId:org,actorUserId:userId,action:'CONTRACT_CREATED',entityType:'Contract',entityId:result.id,auditPeriodId:result.auditPeriodId,after:{template:snapshot.templateVersion,auditedYear:dto.auditedYear}});

      return result;

    }catch(error){if((error as {code?:string}).code==='P2002')throw new ConflictException('Ya existe un contrato de esta empresa para el año auditado.');throw error;}

  }



  private async generateOfficial(org:string,userId:string,id:string,format:GeneratedFormat) {

    // One query captures saved content and its version for both document formats.

    const item=await this.one(org,id);

    if(!this.official.isOfficial(item.variables))throw new BadRequestException('Plantilla no compatible');

    const docx=await this.official.docx(item.variables,item.clauses);

    const buffer=format==='docx'?docx:await this.official.pdf(docx);

    const record=await this.persistOfficialDocument(org,userId,item,item.variables.templateVersion,format,docx,buffer);

    return toSafeDocument(record);

  }


  private async persistOfficialDocument(org:string,userId:string,item:OfficialContractItem,templateVersion:string,format:GeneratedFormat,docx:Buffer,buffer:Buffer) {

    const dir=resolveGeneratedDir();

    if(!existsSync(dir))mkdirSync(dir,{recursive:true});

    const fileName=buildSafeFileName(item.id,format);

    writeFileSync(join(dir,fileName),buffer);

    const docxSha256=createHash('sha256').update(docx).digest('hex');

    const record=await this.prisma.generatedDocument.create({data:{auditPeriodId:item.auditPeriodId,contractId:item.id,generatedById:userId,type:DOCUMENT_TYPES[format],status:'GENERATED',title:`Contrato ${item.auditPeriod.fiscalYear} — ${item.client.legalName}`,storageKey:fileName,originalFileName:buildPublicFileName(item.client.legalName,item.auditPeriod.fiscalYear,format),mimeType:MIME_TYPES[format],sizeBytes:BigInt(buffer.length),sha256:createHash('sha256').update(buffer).digest('hex'),templateVersion,variablesSnapshot:JSON.parse(JSON.stringify({snapshot:item.variables,sections:item.clauses,updatedAt:item.updatedAt,docxSha256})),generatedAt:new Date()}});

    await this.audit.record({organizationId:org,actorUserId:userId,action:format==='docx'?'CONTRACT_DOCX_GENERATED':'CONTRACT_PDF_GENERATED',entityType:'GeneratedDocument',entityId:record.id,auditPeriodId:item.auditPeriodId,after:{contractId:item.id,sha256:record.sha256}});

    return record;

  }


  /**
   * Respuesta binaria directa para Ver / Descargar Word / Descargar PDF.
   * Reutiliza EXACTAMENTE el mismo núcleo de generación: siempre parte del
   * contenido guardado (variables + secciones de ContractClause), nunca de la
   * plantilla original ni de datos antiguos. Si ya existe un documento vigente
   * con la misma huella DOCX, se reutiliza el archivo sin reconvertir.
   */
  async serveDocument(org:string,userId:string,id:string,format:GeneratedFormat) {

    const item=await this.one(org,id);

    if(this.official.isOfficial(item.variables)) {

      const docx=await this.official.docx(item.variables,item.clauses);

      const docxSha256=createHash('sha256').update(docx).digest('hex');

      const previous=await this.prisma.generatedDocument.findFirst({where:{contractId:id,type:DOCUMENT_TYPES[format]},orderBy:{createdAt:'desc'}});

      const snapshot=(previous?.variablesSnapshot ?? null) as unknown as {docxSha256?:unknown} | null;

      if(previous?.storageKey&&snapshot?.docxSha256===docxSha256) {

        const dir=resolveGeneratedDir();

        const absolute=join(dir,previous.storageKey);

        if(absolute.startsWith(dir)&&existsSync(absolute)) {

          await this.audit.record({organizationId:org,actorUserId:userId,action:'CONTRACT_DOCUMENT_DOWNLOADED',entityType:'GeneratedDocument',entityId:previous.id,auditPeriodId:item.auditPeriodId});

          return {buffer:readFileSync(absolute),fileName:previous.originalFileName ?? buildPublicFileName(item.client.legalName,item.auditPeriod.fiscalYear,format),mimeType:MIME_TYPES[format]};

        }

      }

      const buffer=format==='docx'?docx:await this.official.pdf(docx);

      const record=await this.persistOfficialDocument(org,userId,item,item.variables.templateVersion,format,docx,buffer);

      return {buffer,fileName:record.originalFileName ?? buildPublicFileName(item.client.legalName,item.auditPeriod.fiscalYear,format),mimeType:MIME_TYPES[format]};

    }

    // Contratos históricos (motor previo): misma generación de siempre, servida directa.

    const generated=await this.generateContractDocument(org,userId,id,format);

    const stored=await this.prisma.generatedDocument.findUnique({where:{id:generated.id}});

    if(!stored?.storageKey)throw new NotFoundException('Document not found');

    const legacyDir=resolveGeneratedDir();

    const absolute=join(legacyDir,stored.storageKey);

    if(!absolute.startsWith(legacyDir)||!existsSync(absolute))throw new NotFoundException('Document file not found');

    return {buffer:readFileSync(absolute),fileName:stored.originalFileName ?? stored.storageKey,mimeType:MIME_TYPES[format]};

  }



  contracts(org: string) {

    return this.prisma.contract.findMany({

      where: { client: { organizationId: org } },

      include: { client: true, auditPeriod: true, clauses: true },

      orderBy: [{createdAt:'desc'},{id:'asc'}],

    });

  }



  async one(org: string, id: string) {

    const contract = await this.prisma.contract.findFirst({

      where: { id, client: { organizationId: org } },

      include: { clauses: { orderBy: { sortOrder: 'asc' } }, client: true, auditPeriod: true, template: true },

    });

    if (!contract) throw new NotFoundException('Contract not found');

    return contract;

  }

}

