import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsDate, IsEmail, IsIn, IsOptional, IsString, Length } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * Endpoints independientes de representantes (:clientId/representatives).
 * Incluyen el tratamiento obligatorio de la fase Clientes y conservan los
 * campos históricos opcionales sin exponerlos en el formulario principal.
 */
export class CreateRepresentativeDto {
  @Transform(trimmed) @IsString() @IsIn(['Sr.', 'Sra.'], { message: 'Tratamiento: seleccione Sr. o Sra.' }) treatment!: string;
  @Transform(trimmed) @IsString() @Length(1, 255) fullName!: string;
  @Transform(trimmed) @IsString() @Length(1, 64) nationalId!: string;
  @Transform(trimmed) @IsString() @Length(1, 120) position!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() validFrom?: Date;
  @IsOptional() @Type(() => Date) @IsDate() validTo?: Date;
}

export class UpdateRepresentativeDto {
  @IsOptional() @Transform(trimmed) @IsString() @IsIn(['Sr.', 'Sra.'], { message: 'Tratamiento: seleccione Sr. o Sra.' }) treatment?: string;
  @IsOptional() @Transform(trimmed) @IsString() @Length(1, 255) fullName?: string;
  @IsOptional() @Transform(trimmed) @IsString() @Length(1, 64) nationalId?: string;
  @IsOptional() @Transform(trimmed) @IsString() @Length(1, 120) position?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @Type(() => Date) @IsDate() validFrom?: Date;
  @IsOptional() @Type(() => Date) @IsDate() validTo?: Date;
}
