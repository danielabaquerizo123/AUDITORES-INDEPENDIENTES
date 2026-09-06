import { z } from 'zod';

const required = (name: string, max: number) =>
  z.string().trim().min(1, `${name}: campo obligatorio`).max(max, `Máximo ${max} caracteres`);

const requiredEmail = z
  .string()
  .trim()
  .min(1, 'El correo de la empresa: campo obligatorio')
  .email('Ingrese un correo válido')
  .max(255, 'Máximo 255 caracteres');

/**
 * Formulario de cliente: 8 campos definitivos.
 * - Empresa: razón social, RUC (texto, conserva ceros), actividad (texto largo), correo.
 * - Representante: tratamiento (Sr./Sra.), nombre completo, cédula (texto), cargo.
 * Los datos se guardan tal como fueron registrados, sin forzar mayúsculas.
 */
export const clientRegistrationSchema = z.object({
  legalName: required('La razón social', 255),
  taxId: required('El RUC', 64),
  economicActivity: required('La actividad económica', 5000),
  email: requiredEmail,
  treatment: z.enum(['Sr.', 'Sra.'], { errorMap: () => ({ message: 'El tratamiento: campo obligatorio' }) }),
  fullName: required('El representante', 255),
  nationalId: required('La cédula', 64),
  position: required('El cargo', 120),
});
export type ClientRegistrationValues = z.infer<typeof clientRegistrationSchema>;
