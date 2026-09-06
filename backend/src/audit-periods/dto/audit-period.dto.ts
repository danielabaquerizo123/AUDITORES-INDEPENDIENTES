import { Type } from 'class-transformer';
import { AuditPeriodStatus } from '@prisma/client';
import { IsDate, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
export class CreateAuditPeriodDto { @IsString() label!: string; @Type(() => Number) @IsInt() @Min(1900) fiscalYear!: number; @Type(() => Date) @IsDate() startDate!: Date; @Type(() => Date) @IsDate() endDate!: Date; }
export class UpdateAuditPeriodDto { @IsOptional() @IsString() label?: string; @IsOptional() @Type(() => Date) @IsDate() startDate?: Date; @IsOptional() @Type(() => Date) @IsDate() endDate?: Date; @IsOptional() @IsEnum(AuditPeriodStatus) status?: AuditPeriodStatus; }
