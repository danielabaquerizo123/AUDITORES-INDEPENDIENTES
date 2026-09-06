import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomUUID } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ExcelParserService } from '../parsers/excel-parser.service';
import { StatementDetectionService } from '../parsers/statement-detection.service';

function toSafeImport(row: {
  id: string;
  auditPeriodId: string;
  uploadedById: string | null;
  originalFileName: string;
  mimeType: string | null;
  sizeBytes: bigint | number | null;
  sha256: string | null;
  status: unknown;
  version: number;
  attemptCount: number;
  currentYear: number | null;
  previousYear: number | null;
  processingError: string | null;
  detectionSummary: unknown;
  validationIssues: unknown;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: row.id,
    auditPeriodId: row.auditPeriodId,
    uploadedById: row.uploadedById,
    originalFileName: row.originalFileName,
    mimeType: row.mimeType,
    sizeBytes: row.sizeBytes === null ? null : Number(row.sizeBytes),
    sha256: row.sha256,
    status: row.status,
    version: row.version,
    attemptCount: row.attemptCount,
    currentYear: row.currentYear,
    previousYear: row.previousYear,
    processingError: row.processingError,
    detectionSummary: row.detectionSummary,
    validationIssues: row.validationIssues,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Originales fuera del web root: storage/financial-imports (inmutable). */
export function resolveFinancialImportsDir(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 6; depth += 1) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string;
      };
      if (manifest.name === 'sistem-auditoria') {
        const target = join(dir, 'storage', 'financial-imports');
        if (!existsSync(target)) mkdirSync(target, { recursive: true });
        return target;
      }
    } catch {
      // Seguir subiendo.
    }
    dir = join(dir, '..');
  }
  throw new Error('Workspace storage not found');
}

export function buildSafeImportFileName(originalName: string): string {
  const extension = originalName.toLowerCase().split('.').pop() === 'xls' ? 'xls' : 'xlsx';
  return `fin-${randomUUID()}.${extension}`;
}

@Injectable()
export class FinancialImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ExcelParserService,
    private readonly detection: StatementDetectionService,
    private readonly audit: AuditLogService,
  ) {}

  preview(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    this.parser.validateUpload(file);
    const sheets = this.parser.parse(file.buffer);
    return {
      sheets: sheets.map((sheet) => ({ name: sheet.name, grid: sheet.grid, rowOffset: sheet.rowOffset, colOffset: sheet.colOffset })),
      detected: this.detection.detect(sheets).map((item) => ({ type: item.type, sheetName: item.sheetName, confidence: item.confidence })),
    };
  }

  private async periodOr404(organizationId: string, periodId: string) {
    const period = await this.prisma.auditPeriod.findFirst({
      where: { id: periodId, client: { organizationId } },
    });
    if (!period) throw new NotFoundException('Audit period not found');
    return period;
  }

  async upload(
    organizationId: string,
    userId: string,
    periodId: string,
    file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    const period = await this.periodOr404(organizationId, periodId);
    this.parser.validateUpload(file);

    const dir = resolveFinancialImportsDir();
    const storageKey = buildSafeImportFileName(file.originalname);
    writeFileSync(join(dir, storageKey), file.buffer);
    const sha256 = createHash('sha256').update(file.buffer).digest('hex');

    const created = await this.prisma.financialImport.create({
      data: {
        auditPeriodId: period.id,
        uploadedById: userId,
        originalFileName: file.originalname,
        storageKey,
        mimeType: file.mimetype,
        sizeBytes: BigInt(file.buffer.length),
        sha256,
        status: 'UPLOADED',
      },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'FINANCIAL_IMPORT_UPLOADED',
      entityType: 'FinancialImport',
      entityId: created.id,
      auditPeriodId: period.id,
      after: { originalFileName: created.originalFileName, sizeBytes: file.buffer.length, sha256 },
    });
    return toSafeImport(created);
  }

  async list(organizationId: string, periodId: string) {
    const period = await this.periodOr404(organizationId, periodId);
    const rows = await this.prisma.financialImport.findMany({
      where: { auditPeriodId: period.id },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toSafeImport);
  }

  async one(organizationId: string, id: string) {
    const row = await this.prisma.financialImport.findFirst({
      where: { id, auditPeriod: { client: { organizationId } } },
    });
    if (!row) throw new NotFoundException('Financial import not found');
    return toSafeImport(row);
  }

  async statements(organizationId: string, id: string) {
    const row = await this.prisma.financialImport.findFirst({
      where: { id, auditPeriod: { client: { organizationId } } },
      include: { statements: { include: { lines: { orderBy: { sortOrder: 'asc' } } } } },
    });
    if (!row) throw new NotFoundException('Financial import not found');
    return row.statements.map((statement) => ({
      id: statement.id,
      type: statement.type,
      sheetName: statement.sheetName,
      currentYear: statement.currentYear,
      previousYear: statement.previousYear,
      detected: statement.detected,
      confidence: statement.confidence,
      lineCount: statement.lineCount,
      lines: statement.lines.map((line) => ({
        id: line.id,
        sortOrder: line.sortOrder,
        rawLabel: line.rawLabel,
        normalizedKey: line.normalizedKey,
        classified: line.classified,
        classificationSource: line.classificationSource,
        sheetName: line.sheetName,
        sourceRow: line.sourceRow,
        sourceCurrentColumn: line.sourceCurrentColumn,
        sourcePreviousColumn: line.sourcePreviousColumn,
        currentValue: line.currentValue?.toString() ?? null,
        previousValue: line.previousValue?.toString() ?? null,
        difference: line.difference?.toString() ?? null,
        percentageChange: line.percentageChange?.toString() ?? null,
      })),
    }));
  }
}
