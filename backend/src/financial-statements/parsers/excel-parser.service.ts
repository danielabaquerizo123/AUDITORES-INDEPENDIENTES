import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';

export interface ParsedSheet {
  name: string;
  /** Matriz fila-major 0-indexed relativa al inicio del rango usado. */
  grid: unknown[][];
  /** Desplazamiento 0-indexed del rango (!ref) para trazabilidad real. */
  rowOffset: number;
  colOffset: number;
}

/**
 * Límites documentados (Fase 5 Bloque 1): evitan cargar workbooks
 * irresponsablemente grandes en memoria. Superarlos es un error claro,
 * nunca un truncado silencioso.
 */
export const EXCEL_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxSheets: 20,
  maxRowsPerSheet: 5000,
  maxColsPerSheet: 100,
} as const;

const XLSX_SIGNATURE = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const XLS_SIGNATURE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);

function hasSignature(buffer: Buffer, signature: Buffer): boolean {
  if (buffer.length < signature.length) return false;
  return buffer.subarray(0, signature.length).equals(signature);
}

@Injectable()
export class ExcelParserService {
  validateUpload(file: { originalname: string; mimetype: string; size: number; buffer: Buffer }): void {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException('El archivo está vacío');
    }
    if (file.buffer.length > EXCEL_LIMITS.maxFileBytes) {
      throw new BadRequestException(
        `El archivo supera el máximo de ${EXCEL_LIMITS.maxFileBytes / (1024 * 1024)} MB`,
      );
    }
    const extension = file.originalname.toLowerCase().split('.').pop() ?? '';
    if (!['xlsx', 'xls'].includes(extension)) {
      throw new BadRequestException('Extensión no permitida: solo .xlsx o .xls');
    }
    // La firma manda sobre extensión y MIME declarado por el cliente.
    const isXlsx = hasSignature(file.buffer, XLSX_SIGNATURE);
    const isXls = hasSignature(file.buffer, XLS_SIGNATURE);
    if (!isXlsx && !isXls) {
      throw new BadRequestException('El archivo no es un libro Excel válido');
    }
    if (extension === 'xlsx' && !isXlsx) {
      throw new BadRequestException('La extensión .xlsx no coincide con el contenido del archivo');
    }
    if (extension === 'xls' && !isXls) {
      throw new BadRequestException('La extensión .xls no coincide con el contenido del archivo');
    }
  }

  parse(buffer: Buffer): ParsedSheet[] {
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false, WTF: false });
    } catch {
      throw new BadRequestException('No fue posible leer el libro Excel (archivo corrupto)');
    }
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new BadRequestException('El libro Excel no contiene hojas');
    }
    if (workbook.SheetNames.length > EXCEL_LIMITS.maxSheets) {
      throw new BadRequestException(
        `El libro supera el máximo de ${EXCEL_LIMITS.maxSheets} hojas`,
      );
    }
    return workbook.SheetNames.map((name) => {
      const sheet = workbook.Sheets[name];
      const range = sheet['!ref'] ? XLSX.utils.decode_range(sheet['!ref']) : null;
      if (range) {
        const rows = range.e.r - range.s.r + 1;
        const cols = range.e.c - range.s.c + 1;
        if (rows > EXCEL_LIMITS.maxRowsPerSheet || cols > EXCEL_LIMITS.maxColsPerSheet) {
          throw new BadRequestException(
            `La hoja "${name}" supera los límites (${EXCEL_LIMITS.maxRowsPerSheet} filas x ${EXCEL_LIMITS.maxColsPerSheet} columnas)`,
          );
        }
      }
      // blankrows:true preserva los índices para trazabilidad; las filas
      // vacías se omiten al extraer.
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
        header: 1,
        raw: true,
        defval: null,
        blankrows: true,
      }) as unknown[][];
      return { name, grid, rowOffset: range?.s.r ?? 0, colOffset: range?.s.c ?? 0 };
    });
  }
}
