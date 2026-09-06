/** Normaliza texto para comparación determinista (minúsculas, sin tildes). */
export function plainText(value: unknown): string {
  return String(value ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Texto descriptivo real (no numérico): lo que puede ser una etiqueta. */
export function isLabelText(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.trim() !== '';
}
