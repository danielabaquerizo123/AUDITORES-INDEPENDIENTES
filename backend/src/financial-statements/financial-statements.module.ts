import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { FinancialImportsController } from './import/financial-imports.controller';
import { FinancialImportService } from './import/financial-import.service';
import { FinancialProcessingService } from './import/financial-processing.service';
import { FinancialReclassificationService } from './import/financial-reclassification.service';
import { ExcelParserService } from './parsers/excel-parser.service';
import { StatementDetectionService } from './parsers/statement-detection.service';
import { StatementExtractorService } from './parsers/statement-extractor.service';
import { FinancialNumberParser } from './normalization/financial-number.parser';
import { StatementNormalizerService } from './normalization/statement-normalizer.service';
import { ComparativeService } from './comparatives/comparative.service';
import { FinancialValidationService } from './validations/financial-validation.service';

@Module({
  imports: [AuditLogModule],
  controllers: [FinancialImportsController],
  providers: [
    FinancialImportService,
    FinancialProcessingService,
    FinancialReclassificationService,
    ExcelParserService,
    StatementDetectionService,
    StatementExtractorService,
    FinancialNumberParser,
    StatementNormalizerService,
    ComparativeService,
    FinancialValidationService,
  ],
})
export class FinancialStatementsModule {}
