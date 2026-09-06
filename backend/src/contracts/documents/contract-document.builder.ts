import { randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import type { RenderedClause } from '../variables/contract-template.renderer';

export type GeneratedFormat = 'docx' | 'pdf';

export interface ContractDocumentInput {
  title: string;
  subtitle: string;
  sections: RenderedClause[];
  signatories: string[];
}

/** Resolves the repo-level storage/generated dir from either src/ or dist/ layouts. */
export function resolveGeneratedDir(): string {
  let dir = __dirname;
  for (let depth = 0; depth < 6; depth += 1) {
    try {
      const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as {
        name?: string;
      };
      if (manifest.name === 'sistem-auditoria') {
        const generated = join(dir, 'storage', 'generated');
        if (!existsSync(generated)) mkdirSync(generated, { recursive: true });
        return generated;
      }
    } catch {
      // Keep walking up.
    }
    dir = join(dir, '..');
  }
  throw new Error('Workspace storage not found');
}

export function buildSafeFileName(contractId: string, format: GeneratedFormat): string {
  const safeId = contractId.replace(/[^a-zA-Z0-9_-]/g, '');
  return `contract-${safeId}-${Date.now()}-${randomBytes(4).toString('hex')}.${format}`;
}

/**
 * Nombre público del archivo descargado: Contrato_<EMPRESA>_<AÑO>.<ext>.
 * Saneado para que ningún carácter rompa rutas ni cabeceras:
 * sin tildes, solo [a-zA-Z0-9] separados por '_', máximo 100 caracteres.
 */
export function buildPublicFileName(legalName: string, fiscalYear: number | string, format: GeneratedFormat): string {
  const safe =
    (legalName ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 100) || 'Empresa';
  return `Contrato_${safe}_${fiscalYear}.${format}`;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((`${current} ${word}`.trim().length > maxChars && current.length > 0) || word.length > maxChars) {
      if (current.length > 0) lines.push(current);
      current = word.length > maxChars ? '' : word;
      if (word.length > maxChars) {
        for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
      }
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

@Injectable()
export class ContractDocumentBuilder {
  async buildDocx(input: ContractDocumentInput): Promise<Buffer> {
    const children: Paragraph[] = [
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(input.title)] }),
      new Paragraph({ children: [new TextRun({ text: input.subtitle, italics: true })] }),
    ];
    for (const section of input.sections) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(section.title)] }),
      );
      for (const paragraph of section.body.split(/\n{2,}|\n/)) {
        if (paragraph.trim().length > 0) children.push(new Paragraph(paragraph.trim()));
      }
    }
    if (input.signatories.length > 0) {
      children.push(
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun('Firmas')] }),
      );
      for (const signatory of input.signatories) children.push(new Paragraph(signatory));
    }
    return Packer.toBuffer(new Document({ sections: [{ children }] }));
  }

  async buildPdf(input: ContractDocumentInput): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]);
    let y = 800;

    const ensureSpace = (needed: number) => {
      if (y - needed < 40) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
    };

    const drawLines = (lines: string[], size: number, font: typeof regular, gap = 14) => {
      for (const line of lines) {
        ensureSpace(gap);
        page.drawText(line, { x: 50, y, size, font, maxWidth: 495 });
        y -= gap;
      }
    };

    drawLines(wrapText(input.title, 48), 18, bold, 22);
    drawLines(wrapText(input.subtitle, 80), 11, regular);
    y -= 8;

    for (const section of input.sections) {
      ensureSpace(30);
      y -= 6;
      drawLines(wrapText(section.title, 70), 13, bold, 16);
      const bodyLines = section.body.split(/\n{2,}|\n/).flatMap((p) => wrapText(p.trim(), 90));
      drawLines(bodyLines, 11, regular);
      y -= 6;
    }

    if (input.signatories.length > 0) {
      y -= 6;
      drawLines(['Firmas'], 13, bold, 16);
      for (const signatory of input.signatories) drawLines(wrapText(signatory, 90), 11, regular);
    }

    return Buffer.from(await pdf.save());
  }
}
