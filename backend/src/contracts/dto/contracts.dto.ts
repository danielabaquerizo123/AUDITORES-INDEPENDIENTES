import { Type } from 'class-transformer';
import {
  IsArray, IsDateString,
  Min, Max, MaxLength, Matches, IsNotEmpty,
  IsBoolean,
  IsDate,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { ContractStatus } from '@prisma/client';

// Rechaza controles C0/C1 no imprimibles, conservando tabulaciones y saltos de línea (TAB, LF y CR).
// eslint-disable-next-line no-control-regex
const CONTRACT_BODY_PATTERN = /^[^\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]*$/u;

export class TemplateClauseDto {
  @IsString()
  clauseKey!: string;
  @IsString()
  title!: string;
  @IsString()
  body!: string;
  @Type(() => Number)
  @IsInt()
  sortOrder!: number;
  @IsOptional()
  @IsBoolean()
  required?: boolean;
}

export class CreateTemplateDto {
  @IsString()
  name!: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateClauseDto)
  clauses!: TemplateClauseDto[];
}

export class CreateContractDto {
  @IsString()
  templateId!: string;
  @IsOptional()
  @IsString()
  contractNumber?: string;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  signingDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveFrom?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveTo?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  reportDeliveryDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  taxReportDeliveryDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  informationDeliveryDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  draftReportDueDate?: Date;
  @IsOptional()
  @IsString()
  feeNet?: string;
  @IsOptional()
  @IsString()
  currency?: string;
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ContractSectionEditDto {
 @IsString() @Matches(/^p\d+$/) clauseKey!: string;
 @IsString() @MaxLength(50000) @Matches(CONTRACT_BODY_PATTERN) body!: string;
}

/** Contenido de una única cláusula persistida del contrato. */
export class UpdateContractClauseDto {
 @IsString() @MaxLength(50000) @Matches(CONTRACT_BODY_PATTERN) body!: string;
}

export class CreateContractClauseDto {
 @IsString() @IsNotEmpty() @MaxLength(240) title!: string;
 @IsString() @IsNotEmpty() @MaxLength(50000) @Matches(CONTRACT_BODY_PATTERN) body!: string;
 @IsOptional() @IsString() insertBeforeClauseId?: string;
}

export class CreateContractParagraphDto {
 @IsString() @IsNotEmpty() @MaxLength(50000) @Matches(CONTRACT_BODY_PATTERN) body!: string;
}

export class PrepareOfficialContractDto {
 @IsString() @IsNotEmpty() clientId!: string;
 @Type(() => Number) @IsInt() @Min(1900) @Max(2200) auditedYear!: number;
}
export class AssignContractAuditorDto { @IsString() @IsNotEmpty() auditorId!: string; }

export class UpdateContractDto {
 @IsOptional() @IsArray() @ValidateNested({each:true}) @Type(() => ContractSectionEditDto) sections?: ContractSectionEditDto[];
 @IsOptional() @IsDateString() expectedUpdatedAt?: string;
  @IsOptional()
  @IsString()
  contractNumber?: string;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  signingDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveFrom?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  effectiveTo?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  reportDeliveryDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  taxReportDeliveryDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  informationDeliveryDate?: Date;
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  draftReportDueDate?: Date;
  @IsOptional()
  @IsString()
  feeNet?: string;
  @IsOptional()
  @IsString()
  currency?: string;
  @IsOptional()
  @IsString()
  notes?: string;
  @IsOptional()
  @IsEnum(ContractStatus)
  status?: ContractStatus;
}

export class GenerateDocumentDto {
  @IsIn(['docx', 'pdf'])
  format!: 'docx' | 'pdf';
}

export class GenerateBatchDto {
  @IsArray()
  @IsString({ each: true })
  contractIds!: string[];
  @IsIn(['docx', 'pdf'])
  format!: 'docx' | 'pdf';
}

