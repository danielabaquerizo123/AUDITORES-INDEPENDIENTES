import { Transform, Type } from 'class-transformer';
import { IsEmail, IsInt, IsOptional, IsString, Length, Matches, Max, Min } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const titlePattern = /^(?:(?:Lcdo\.|CPA\.|Ing\.|Econ\.|Abg\.|Mgtr\.|Mgs\.|Dr\.|PhD\.)\s*)+$/;

export class CreateAuditorDto {
 @Transform(trimmed) @IsString() @Length(1,255,{message:'Los nombres y apellidos son obligatorios.'}) fullName!:string;
 @Transform(trimmed) @Matches(/^\d{10}$/,{message:'La cédula debe contener 10 dígitos numéricos.'}) cedula!:string;
 @Transform(trimmed) @Matches(/^\d{13}$/,{message:'El RUC debe contener 13 dígitos numéricos.'}) ruc!:string;
 @Transform(trimmed) @Matches(titlePattern,{message:'Utilice únicamente la abreviatura del título profesional. Ejemplo: Ing. en lugar de Ingeniero.'}) professionalTitles!:string;
 @Transform(trimmed) @IsString() @Length(1,120,{message:'El cargo es obligatorio.'}) position!:string;
 @Transform(trimmed) @IsString() @Length(1,120,{message:'El Registro Nacional de Auditor Externo es obligatorio.'}) externalAuditorRegistration!:string;
 @Transform(trimmed) @IsString() @Length(1,120,{message:'El Número de Perito Función Judicial es obligatorio.'}) judicialExpertNumber!:string;
 @Transform(trimmed) @IsString() @Length(1,120,{message:'La Matrícula de Contador es obligatoria.'}) accountantLicenseNumber!:string;
 @Transform(trimmed) @IsString() @Length(1,500,{message:'La dirección es obligatoria.'}) address!:string;
 @Transform(trimmed) @Matches(/^[0-9+()\-\s]{7,30}$/,{message:'Ingrese un teléfono válido.'}) phone!:string;
 @Transform(trimmed) @IsEmail({}, {message:'Ingrese un correo válido.'}) email!:string;
}

export class UpdateAuditorDto extends CreateAuditorDto {}

export class AuditorListQuery {
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) page?:number;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) pageSize?:number;
 @IsOptional() @IsString() @Length(0,255) search?:string;
}
