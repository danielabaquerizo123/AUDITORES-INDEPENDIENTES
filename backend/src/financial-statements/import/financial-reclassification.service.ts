import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { keyStatementType } from '../normalization/statement-normalizer.service';
import {
  FinancialValidationService,
  ProcessedStatement,
  decideImportStatus,
} from '../validations/financial-validation.service';

/**
 * Reclasificación manual de líneas. SOLO cambia clasificación
 * (normalizedKey / classified / classificationSource); los importes,
 * etiquetas y origen permanecen intactos. Tras el cambio se recalculan
 * validaciones y estado del import sin forzar PROCESSED.
 */
@Injectable()
export class FinancialReclassificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: FinancialValidationService,
    private readonly audit: AuditLogService,
  ) {}

  async reclassify(
    organizationId: string,
    userId: string,
    lineId: string,
    normalizedKey: string,
  ) {
    const line = await this.prisma.financialStatementLine.findFirst({
      where: {
        id: lineId,
        statement: { import: { auditPeriod: { client: { organizationId } } } },
      },
      include: { statement: true },
    });
    if (!line) throw new NotFoundException('Financial statement line not found');

    const ownerType = keyStatementType(normalizedKey);
    if (!ownerType) {
      throw new BadRequestException(`Clave canónica desconocida: ${normalizedKey}`);
    }
    if (ownerType !== line.statement.type) {
      throw new BadRequestException(
        `La clave ${normalizedKey} pertenece a ${ownerType} y no puede usarse en ${line.statement.type}`,
      );
    }

    const previousKey = line.normalizedKey;
    const updated = await this.prisma.financialStatementLine.update({
      where: { id: lineId },
      data: { normalizedKey, classified: true, classificationSource: 'MANUAL' },
    });

    const status = await this.recalculate(line.statement.importId);

    const importRow = await this.prisma.financialImport.findUnique({
      where: { id: line.statement.importId },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'FINANCIAL_LINE_RECLASSIFIED',
      entityType: 'FinancialStatementLine',
      entityId: lineId,
      auditPeriodId: importRow?.auditPeriodId,
      before: { normalizedKey: previousKey } as unknown as Prisma.InputJsonValue,
      after: {
        normalizedKey,
        classificationSource: 'MANUAL',
        importId: line.statement.importId,
        lineId,
      } as unknown as Prisma.InputJsonValue,
    });

    return {
      id: updated.id,
      statementId: updated.statementId,
      rawLabel: updated.rawLabel,
      normalizedKey: updated.normalizedKey,
      classified: updated.classified,
      classificationSource: updated.classificationSource,
      currentValue: updated.currentValue?.toString() ?? null,
      previousValue: updated.previousValue?.toString() ?? null,
      difference: updated.difference?.toString() ?? null,
      percentageChange: updated.percentageChange?.toString() ?? null,
      importStatus: status,
    };
  }

  private async recalculate(importId: string) {
    const statements = await this.prisma.financialStatement.findMany({
      where: { importId },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });
    const processed: ProcessedStatement[] = statements.map((statement) => ({
      type: statement.type,
      sheetName: statement.sheetName ?? '',
      confidence: statement.confidence ?? 0,
      currentYear: statement.currentYear,
      previousYear: statement.previousYear,
      lines: statement.lines.map((line) => ({
        sortOrder: line.sortOrder,
        rawLabel: line.rawLabel,
        normalizedKey: line.normalizedKey,
        classified: line.classified,
        sheetName: line.sheetName ?? '',
        sourceRow: line.sourceRow ?? 0,
        sourceCurrentColumn: line.sourceCurrentColumn,
        sourcePreviousColumn: line.sourcePreviousColumn,
        currentValue: line.currentValue,
        previousValue: line.previousValue,
      })),
    }));
    const issues = this.validation.validate(processed);
    const current = await this.prisma.financialImport.findUnique({ where: { id: importId } });
    if (!current || current.status === 'FAILED' || current.status === 'PROCESSING') {
      return current?.status ?? 'REVIEW_REQUIRED';
    }
    const status = decideImportStatus(processed, issues);
    await this.prisma.financialImport.update({
      where: { id: importId },
      data: {
        status,
        validationIssues: issues as unknown as Prisma.InputJsonValue,
      },
    });
    return status;
  }
}
