import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { PrismaService } from '../../database/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ExcelParserService } from '../parsers/excel-parser.service';
import { StatementDetectionService } from '../parsers/statement-detection.service';
import { StatementExtractorService } from '../parsers/statement-extractor.service';
import { ComparativeService } from '../comparatives/comparative.service';
import {
  FinancialValidationService,
  ProcessedStatement,
  ValidationIssue,
  decideImportStatus,
} from '../validations/financial-validation.service';
import { resolveFinancialImportsDir } from './financial-import.service';

// Códigos que obligan REVIEW_REQUIRED (el resto de issues solo se informan).

/**
 * Orquesta el pipeline: UPLOADED → PROCESSING → PROCESSED | REVIEW_REQUIRED | FAILED.
 * El original nunca se modifica; el reproceso elimina y recrea resultados en
 * transacción (sin duplicados silenciosos) e incrementa version (trazable).
 */
@Injectable()
export class FinancialProcessingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parser: ExcelParserService,
    private readonly detection: StatementDetectionService,
    private readonly extractor: StatementExtractorService,
    private readonly comparatives: ComparativeService,
    private readonly validation: FinancialValidationService,
    private readonly audit: AuditLogService,
  ) {}

  async process(organizationId: string, userId: string, importId: string) {
    const current = await this.prisma.financialImport.findFirst({
      where: { id: importId, auditPeriod: { client: { organizationId } } },
    });
    if (!current) throw new NotFoundException('Financial import not found');
    if (!current.storageKey) throw new NotFoundException('Import file not found');

    await this.prisma.financialImport.update({
      where: { id: importId },
      data: { status: 'PROCESSING', processingError: null, attemptCount: current.attemptCount + 1 },
    });
    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'FINANCIAL_IMPORT_PROCESSING_STARTED',
      entityType: 'FinancialImport',
      entityId: importId,
      auditPeriodId: current.auditPeriodId,
      after: { version: current.version, attempt: current.attemptCount + 1 },
    });

    try {
      const buffer = readFileSync(join(resolveFinancialImportsDir(), current.storageKey));
      const sheets = this.parser.parse(buffer);
      const byName = new Map(sheets.map((sheet) => [sheet.name, sheet]));
      const detected = this.detection.detect(sheets);

      const issues: ValidationIssue[] = [];
      const statements: ProcessedStatement[] = [];
      for (const item of detected) {
        const sheet = byName.get(item.sheetName);
        if (!sheet) continue;
        if (item.ambiguousColumns) {
          // Sin columnas confiables no se extrae nada: mejor 0 líneas con
          // issue explícito que líneas basura con columnas adivinadas.
          issues.push({
            code: 'AMBIGUOUS_COLUMNS',
            message: `Columnas ambiguas en la hoja "${item.sheetName}": revise años y columnas`,
            statementType: item.type,
            sheetName: item.sheetName,
          });
          statements.push({
            type: item.type,
            sheetName: item.sheetName,
            confidence: item.confidence,
            currentYear: item.currentYear,
            previousYear: item.previousYear,
            lines: [],
          });
          continue;
        }
        statements.push(this.extractor.extract(item, sheet, issues));
      }
      issues.push(...this.validation.validate(statements));

      const status = decideImportStatus(statements, issues);
      const years = this.resolveYears(statements);
      const summary = statements.map((s) => ({
        type: s.type,
        sheetName: s.sheetName,
        confidence: s.confidence,
        currentYear: s.currentYear,
        previousYear: s.previousYear,
        lineCount: s.lines.length,
        unclassified: s.lines.filter((l) => !l.classified).length,
      }));

      await this.prisma.$transaction(async (tx) => {
        await tx.financialStatement.deleteMany({ where: { importId } });
        for (const statement of statements) {
          const created = await tx.financialStatement.create({
            data: {
              importId,
              type: statement.type,
              sheetName: statement.sheetName,
              currentYear: statement.currentYear,
              previousYear: statement.previousYear,
              detected: true,
              confidence: statement.confidence,
              lineCount: statement.lines.length,
            },
          });
          for (const line of statement.lines) {
            const compared = this.comparatives.compare(line.currentValue, line.previousValue);
            await tx.financialStatementLine.create({
              data: {
                statementId: created.id,
                sortOrder: line.sortOrder,
                rawLabel: line.rawLabel,
                normalizedKey: line.normalizedKey,
                classified: line.classified,
                sheetName: line.sheetName,
                sourceRow: line.sourceRow,
                sourceCurrentColumn: line.sourceCurrentColumn,
                sourcePreviousColumn: line.sourcePreviousColumn,
                currentValue: line.currentValue ?? undefined,
                previousValue: line.previousValue ?? undefined,
                difference: compared.difference ?? undefined,
                percentageChange: compared.percentageChange ?? undefined,
              },
            });
          }
        }
        await tx.financialImport.update({
          where: { id: importId },
          data: {
            status,
            version: current.version + 1,
            currentYear: years.current,
            previousYear: years.previous,
            processingError: status === 'FAILED' ? (issues[0]?.message ?? 'Sin resultados') : null,
            detectionSummary: summary as unknown as Prisma.InputJsonValue,
            validationIssues: issues as unknown as Prisma.InputJsonValue,
          },
        });
      });

      await this.audit.record({
        organizationId,
        actorUserId: userId,
        action: 'FINANCIAL_IMPORT_PROCESSING_FINISHED',
        entityType: 'FinancialImport',
        entityId: importId,
        auditPeriodId: current.auditPeriodId,
        after: { status, statements: statements.length, issues: issues.length },
      });
      return { id: importId, status, issues, statements: summary };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error de procesamiento';
      await this.prisma.financialImport.update({
        where: { id: importId },
        data: { status: 'FAILED', processingError: message },
      });
      await this.audit.record({
        organizationId,
        actorUserId: userId,
        action: 'FINANCIAL_IMPORT_PROCESSING_FAILED',
        entityType: 'FinancialImport',
        entityId: importId,
        auditPeriodId: current.auditPeriodId,
        after: { error: message },
      });
      throw error;
    }
  }

  private resolveYears(statements: ProcessedStatement[]): {
    current: number | null;
    previous: number | null;
  } {
    const currents = statements.map((s) => s.currentYear).filter((y): y is number => y !== null);
    const previous = statements.map((s) => s.previousYear).filter((y): y is number => y !== null);
    return {
      current: currents.length > 0 ? Math.max(...currents) : null,
      previous: previous.length > 0 ? Math.max(...previous) : null,
    };
  }
}
