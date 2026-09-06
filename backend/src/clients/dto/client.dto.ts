import { Type, Transform } from 'class-transformer';
import { IsEmail, IsIn, IsInt, IsOptional, IsString, Length, Matches, Max, Min, ValidateNested } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Tratamientos permitidos para el representante legal. */
export const REPRESENTATIVE_TREATMENTS = ['Sr.', 'Sra.'] as const;

/**
 * Datos del representante legal (4 campos definitivos).
 * RUC/cédula se almacenan como texto para conservar ceros iniciales.
 */
export class ClientRepresentativeInput {
  @IsOptional() @IsString() id?: string;
  @Transform(trimmed) @IsString() @IsIn([...REPRESENTATIVE_TREATMENTS], { message: 'Tratamiento: seleccione Sr. o Sra.' }) treatment!: string;
  @Transform(trimmed) @IsString() @Length(1, 255, { message: 'El nombre del representante es obligatorio.' }) fullName!: string;
  @Transform(trimmed) @IsString() @Length(1, 64, { message: 'La cédula es obligatoria.' }) nationalId!: string;
  @Transform(trimmed) @IsString() @Length(1, 120, { message: 'El cargo es obligatorio.' }) position!: string;
}

/**
 * Datos de la empresa (4 campos definitivos) + representante legal.
 * Los campos históricos (tradeName, phone, address, city, province, status,
 * correos/teléfonos del representante) se conservan en base de datos pero
 * ya no forman parte del formulario ni de estos DTOs.
 */
export class CreateClientDto {
  @Transform(trimmed) @IsString() @Length(1, 255, { message: 'La razón social es obligatoria.' }) legalName!: string;
  @Transform(trimmed) @IsString() @Length(1, 64, { message: 'El RUC es obligatorio.' }) taxId!: string;
  @Transform(trimmed) @IsString() @Length(1, 5000, { message: 'La actividad económica es obligatoria.' }) economicActivity!: string;
  @Transform(trimmed) @IsEmail({}, { message: 'Ingrese un correo válido.' }) email!: string;
  @IsOptional() @IsString() @Length(2, 2) @Matches(/^[A-Z]{2}$/) country?: string;
  @ValidateNested() @Type(() => ClientRepresentativeInput) representative!: ClientRepresentativeInput;
}

export class UpdateClientDto {
  @IsOptional() @Transform(trimmed) @IsString() @Length(1, 255, { message: 'La razón social es obligatoria.' }) legalName?: string;
  @IsOptional() @Transform(trimmed) @IsString() @Length(1, 64, { message: 'El RUC es obligatorio.' }) taxId?: string;
  @IsOptional() @Transform(trimmed) @IsString() @Length(1, 5000, { message: 'La actividad económica es obligatoria.' }) economicActivity?: string;
  @IsOptional() @Transform(trimmed) @IsEmail({}, { message: 'Ingrese un correo válido.' }) email?: string;
  @IsOptional() @IsString() @Length(2, 2) @Matches(/^[A-Z]{2}$/) country?: string;
  @IsOptional() @ValidateNested() @Type(() => ClientRepresentativeInput) representative?: ClientRepresentativeInput;
}

export class ClientListQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) pageSize?: number;
  @IsOptional() @IsString() @Length(0, 255) search?: string;
}
