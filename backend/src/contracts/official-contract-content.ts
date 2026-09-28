export const OFFICIAL_UAFE_CLAUSE_KEY = 'p57-uafe';
export const LEGACY_UAFE_CLAUSE_KEY = 'custom-uafe';
export const APPROVED_P52_REPAIR_CONTRACT_ID = 'cmtoyk9tl0061fpf0wqse4yux';
export const APPROVED_P52_REPAIR_BODY = 'Por " El Auditor":  Mail: carlos.mendoza.auditor@example.com';
export const OFFICIAL_UAFE_BODY = 'La Unidad de Análisis Financiero y Económico, mediante resolución No. UAFE-DG-2022-0130, obliga a los contadores o personas jurídicas que ofrecen servicios contables, incluyendo la auditoría a reportar operaciones y transacciones mencionadas en el Art 2 de dicha resolución y que superen el monto de $10.000,00 mensuales, a presentar el reporte de operaciones sospechosas (ROS), el cual deberá ser enviado a través del Sistema para la Prevención del Lavado de Activos y Financiamiento del Terrorismo(SISLAFT). No obstante, cualquier comunicación preliminar será informada a la administración previo a su reporte.';

export interface OfficialClauseContent {
  id?: string;
  clauseKey: string;
  title: string;
  body: string;
  sortOrder: number;
  isCustom: boolean;
  parentClauseKey: string | null;
  enabled?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type OfficialTemplateSection = Pick<OfficialClauseContent, 'clauseKey' | 'title' | 'body' | 'sortOrder'> &
  Partial<Pick<OfficialClauseContent, 'isCustom' | 'parentClauseKey'>>;

export interface OfficialContractContentState {
  id: string;
  variables: unknown;
  auditorSnapshot: unknown;
  updatedAt?: Date;
  clauses: OfficialClauseContent[];
}

export interface PlannedClauseChange {
  kind: 'update';
  clauseId: string;
  clauseKey: string;
      expected: Pick<OfficialClauseContent, 'clauseKey' | 'body' | 'sortOrder' | 'isCustom' | 'parentClauseKey'> & { updatedAt?: Date };
  data: Partial<Pick<OfficialClauseContent, 'clauseKey' | 'body' | 'sortOrder' | 'isCustom' | 'parentClauseKey'>>;
  reasons: string[];
}

export interface PlannedClauseCreate {
  kind: 'create';
  clauseKey: typeof OFFICIAL_UAFE_CLAUSE_KEY;
  title: '';
  body: typeof OFFICIAL_UAFE_BODY;
  sortOrder: number;
  isCustom: false;
  parentClauseKey: 'p57';
  reason: string;
}

export interface ManualReviewItem {
  clauseKey: string;
  reason: string;
}

export interface OfficialContractContentPlan {
  contractId: string;
  changes: PlannedClauseChange[];
  creates: PlannedClauseCreate[];
  manualReview: ManualReviewItem[];
}

export function compareOfficialClauseOrder(
  left: Pick<OfficialClauseContent, 'sortOrder' | 'clauseKey'>,
  right: Pick<OfficialClauseContent, 'sortOrder' | 'clauseKey'>,
): number {
  if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
  return left.clauseKey < right.clauseKey ? -1 : left.clauseKey > right.clauseKey ? 1 : 0;
}

export function prepareNewOfficialContractSections(sections: OfficialTemplateSection[]): OfficialClauseContent[] {
  const prepared: OfficialClauseContent[] = sections.map(section => ({
    ...section,
    isCustom: section.isCustom ?? false,
    parentClauseKey: section.parentClauseKey ?? null,
  }));
  const replace = (key: string, before: string, after: string) => {
    const clause = prepared.find(section => section.clauseKey === key);
    if (clause) clause.body = clause.body.replace(before, after);
  };

  replace('p5', 'actividad principal es la ', 'actividad principal es ');
  replace('p6', 'y Cuenta con la calificación', 'y cuenta con la calificación');
  replace('p33', 'Valores y Seguros las normas de carácter tributarlo', 'Valores y Seguros, las normas de carácter tributario');
  replace('p33', 'Valores y Seguros las normas de carácter tributario', 'Valores y Seguros, las normas de carácter tributario');
  replace('p39', 'Información Financiera – NllF,', 'Información Financiera – NIIF,');
  replace('p54', 'Email:', 'E-mail:');
  const auditorEmail = prepared.find(section => section.clauseKey === 'p55');
  if (auditorEmail) auditorEmail.body = 'Por " El Auditor":  E-mail:';
  replace('p60', 'ciuda1e Babahoyo', 'ciudad de Babahoyo');

  const confidentiality = prepared.find(section => section.clauseKey === 'p57');
  if (!confidentiality) throw new Error('No se encontró la cláusula oficial p57.');
  const existingUafe = prepared.find(section => section.clauseKey === OFFICIAL_UAFE_CLAUSE_KEY);
  if (existingUafe) throw new Error('La sección UAFE ya está presente en la plantilla de contrato.');
  const uafe: OfficialClauseContent = {
    clauseKey: OFFICIAL_UAFE_CLAUSE_KEY,
    title: '',
    body: OFFICIAL_UAFE_BODY,
    sortOrder: confidentiality.sortOrder,
    isCustom: false,
    parentClauseKey: 'p57',
  };
  prepared.push(uafe);
  return prepared.sort(compareOfficialClauseOrder);
}

const normalized = (value: string) => value.normalize('NFC').replace(/\s+/g, ' ').trim();
const occurrences = (body: string, fragment: string) => body.split(fragment).length - 1;
const jsonObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const snapshotEmail = (value: unknown): string => {
  const email = jsonObject(value).email;
  return typeof email === 'string' ? email.trim() : '';
};

export function planOfficialContractContentUpdate(
  contract: OfficialContractContentState,
  templateParagraphs: string[],
  context: { verifiedHistoricalP52Email?: string } = {},
): OfficialContractContentPlan {
  const changes = new Map<string, PlannedClauseChange>();
  const manualReview: ManualReviewItem[] = [];
  const review = (clauseKey: string, reason: string) => {
    if (!manualReview.some(item => item.clauseKey === clauseKey && item.reason === reason)) manualReview.push({ clauseKey, reason });
  };
  const update = (clause: OfficialClauseContent, data: PlannedClauseChange['data'], reason: string) => {
    if (!clause.id) {
      review(clause.clauseKey, 'La fila no tiene ID; no puede actualizarse de forma segura.');
      return;
    }
    const current = changes.get(clause.id) ?? {
      kind: 'update' as const,
      clauseId: clause.id,
      clauseKey: clause.clauseKey,
      expected: {
        clauseKey: clause.clauseKey,
        body: clause.body,
        sortOrder: clause.sortOrder,
        isCustom: clause.isCustom,
        parentClauseKey: clause.parentClauseKey,
        updatedAt: clause.updatedAt,
      },
      data: {},
      reasons: [],
    };
    Object.assign(current.data, data);
    current.reasons.push(reason);
    changes.set(clause.id, current);
  };
  const clause = (key: string) => {
    const found = contract.clauses.filter(item => item.clauseKey === key);
    if (found.length > 1) {
      review(key, 'Hay claves duplicadas dentro del contrato; no se actualiza automáticamente.');
      return undefined;
    }
    return found[0];
  };
  const patchFragment = (key: string, before: string, after: string, reason: string, related?: string) => {
    const target = clause(key);
    if (!target) return;
    const count = occurrences(target.body, before);
    if (count === 1) {
      update(target, { body: target.body.replace(before, after) }, reason);
      return;
    }
    if (count > 1) {
      review(key, `El fragmento esperado aparece ${count} veces; requiere revisión manual.`);
      return;
    }
    if (target.body.includes(after)) return;
    if (related && target.body.includes(related)) review(key, 'El texto tiene una variante no reconocida; no se reemplaza el body.');
    else if (target.body.trim()) review(key, 'El body no coincide con el texto base esperado ni con la corrección conocida.');
  };

  patchFragment('p5', 'actividad principal es la ', 'actividad principal es ', 'Retirar artículo fijo antes de la actividad económica.', 'actividad principal');
  patchFragment('p6', 'y Cuenta con la calificación', 'y cuenta con la calificación', 'Corregir mayúscula sin cambiar datos del auditor.', 'Cuenta con la calificación');
  const p33 = clause('p33');
  if (p33) {
    const variants = [
      ['Valores y Seguros las normas de carácter tributarlo', 'Valores y Seguros, las normas de carácter tributario'],
      ['Valores y Seguros las normas de carácter tributario', 'Valores y Seguros, las normas de carácter tributario'],
    ] as const;
    const matches = variants.filter(([before]) => occurrences(p33.body, before) === 1);
    if (matches.length === 1) update(p33, { body: p33.body.replace(matches[0][0], matches[0][1]) }, 'Corregir puntuación y errata tributaria.');
    else if (matches.length > 1 || variants.some(([before]) => occurrences(p33.body, before) > 1)) review('p33', 'El fragmento esperado aparece repetido o ambiguo; requiere revisión manual.');
    else if (!p33.body.includes('Valores y Seguros, las normas de carácter tributario') && p33.body.includes('Valores y Seguros')) review('p33', 'El texto tiene una variante no reconocida; no se reemplaza el body.');
  }
  patchFragment('p39', 'Información Financiera – NllF,', 'Información Financiera – NIIF,', 'Corregir errata NIIF.', 'NllF');
  patchFragment('p54', 'Email:', 'E-mail:', 'Corregir solo el rótulo del correo de la compañía.', 'Email:');
  patchFragment('p60', 'ciuda1e', 'ciudad de', 'Corregir errata sin cambiar ciudad ni fecha.', 'ciuda1e');

  const historicalAuditorEmail = snapshotEmail(contract.auditorSnapshot) || snapshotEmail(jsonObject(contract.variables).AUDITOR);
  const p55 = clause('p55');
  if (p55) {
    const expectedBase = templateParagraphs[55];
    const blankCorrectLabel = 'Por " El Auditor":  E-mail:';
    const correctLine = historicalAuditorEmail ? `Por " El Auditor":  E-mail: ${historicalAuditorEmail}` : blankCorrectLabel;
    if (p55.body === correctLine) {
      // Ya está actualizado, o todavía no había auditor asignado.
    } else if (historicalAuditorEmail && (p55.body === expectedBase || p55.body === `Por " El Auditor":  Mail: ${historicalAuditorEmail}` || p55.body === blankCorrectLabel)) {
      update(p55, { body: correctLine }, 'Usar correo histórico del auditor del snapshot en su línea oficial.');
    } else if (p55.body === blankCorrectLabel && !historicalAuditorEmail) {
      // Contrato aún sin auditor; no hay correo histórico que insertar.
    } else {
      review('p55', historicalAuditorEmail
        ? 'La línea del auditor no coincide con la plantilla ni con su snapshot histórico.'
        : 'No existe correo histórico verificable en auditorSnapshot; no se sustituye la dirección.');
    }
  } else {
    review('p55', 'Falta la fila oficial del correo del auditor.');
  }

  const p52 = clause('p52');
  if (p52) {
    const baseline = templateParagraphs[52];
    if (p52.body !== baseline) {
      const knownEmails = [snapshotEmail(contract.auditorSnapshot), snapshotEmail(jsonObject(contract.variables).AUDITOR)].filter(Boolean);
      const bugPattern = /^Por " El Auditor": {2}Mail: (\S+)$/;
      const match = p52.body.match(bugPattern);
      if (match && knownEmails.includes(match[1])) {
        update(p52, { body: baseline }, 'Restaurar NOVENA: p52 coincide exactamente con la sustitución histórica por el correo del auditor.');
      } else if (contract.id === APPROVED_P52_REPAIR_CONTRACT_ID && p52.body === APPROVED_P52_REPAIR_BODY &&
        match && context.verifiedHistoricalP52Email === match[1]) {
        update(p52, { body: baseline }, 'Restaurar NOVENA p52: este contrato fue aprobado manualmente y el email coincide con los snapshots históricos de documentos generados del auditor anterior.');
      } else {
        review('p52', match
          ? 'p52 coincide con el patrón del bug, pero el correo no coincide con auditorSnapshot.'
          : 'p52 difiere del texto oficial y no coincide exactamente con el patrón conocido del bug.');
      }
    }
  } else {
    review('p52', 'Falta la fila oficial que contiene el encabezado y primer párrafo de NOVENA.');
  }

  const p57 = clause('p57');
  const uafeRows = contract.clauses.filter(item =>
    item.clauseKey === OFFICIAL_UAFE_CLAUSE_KEY || item.clauseKey === LEGACY_UAFE_CLAUSE_KEY || normalized(item.body) === normalized(OFFICIAL_UAFE_BODY),
  );
  const p57ContainsUafe = !!p57 && normalized(p57.body).includes(normalized(OFFICIAL_UAFE_BODY));
  let creates: PlannedClauseCreate[] = [];
  if (uafeRows.length > 1 || p57ContainsUafe && uafeRows.length > 0) {
    review(OFFICIAL_UAFE_CLAUSE_KEY, 'Se detectaron duplicados o el texto UAFE ya está mezclado en p57; no se agrega ni elimina contenido automáticamente.');
  } else if (uafeRows.length === 1) {
    const existing = uafeRows[0];
    if (normalized(existing.body) !== normalized(OFFICIAL_UAFE_BODY)) {
      review(existing.clauseKey, 'La fila UAFE existente fue modificada; no se sobrescribe.');
    } else if (existing.clauseKey === LEGACY_UAFE_CLAUSE_KEY || existing.isCustom || existing.parentClauseKey !== 'p57' || existing.sortOrder !== p57?.sortOrder) {
      update(existing, {
        clauseKey: OFFICIAL_UAFE_CLAUSE_KEY,
        isCustom: false,
        parentClauseKey: 'p57',
        sortOrder: p57?.sortOrder ?? existing.sortOrder,
      }, 'Reclasificar la fila UAFE oficial conservando su ID y texto exacto.');
    }
  } else if (p57ContainsUafe) {
    review('p57', 'UAFE ya aparece dentro del body de p57; requiere revisión para separarlo sin perder personalizaciones.');
  } else if (!p57) {
    review(OFFICIAL_UAFE_CLAUSE_KEY, 'Falta p57; no es posible determinar el ancla oficial de UAFE.');
  } else {
    creates = [{
      kind: 'create',
      clauseKey: OFFICIAL_UAFE_CLAUSE_KEY,
      title: '',
      body: OFFICIAL_UAFE_BODY,
      sortOrder: p57.sortOrder,
      isCustom: false,
      parentClauseKey: 'p57',
      reason: 'Agregar el párrafo oficial UAFE inmediatamente después de p57.',
    }];
  }

  return { contractId: contract.id, changes: [...changes.values()], creates, manualReview };
}
