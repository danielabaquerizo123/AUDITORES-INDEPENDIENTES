const fs = require('fs');
const {
  OFFICIAL_UAFE_BODY,
  OFFICIAL_UAFE_CLAUSE_KEY,
  LEGACY_UAFE_CLAUSE_KEY,
  APPROVED_P52_REPAIR_BODY,
  APPROVED_P52_REPAIR_CONTRACT_ID,
  planOfficialContractContentUpdate,
  prepareNewOfficialContractSections,
} = require('../dist/src/contracts/official-contract-content');

const template = JSON.parse(fs.readFileSync('storage/templates/contracts/template-map.json', 'utf8'));

function fixture() {
  const clauses = template.paragraphs.map((body, index) => ({
    id: `row-${index}`,
    clauseKey: `p${index}`,
    title: index < 2 ? 'Título del contrato' : `Sección ${index}`,
    body,
    sortOrder: index,
    isCustom: false,
    parentClauseKey: null,
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  })).filter(row => row.body.trim());
  clauses.push({
    id: 'custom-date', clauseKey: 'custom-date', title: '', body: 'Fecha personalizada: 14 de marzo',
    sortOrder: 12, isCustom: true, parentClauseKey: 'p12', updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  });
  clauses.push({
    id: 'custom-user', clauseKey: 'custom-user', title: '', body: 'Párrafo manual',
    sortOrder: 30, isCustom: true, parentClauseKey: 'p30', updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  });
  return {
    id: 'contract-1',
    variables: { templateVersion: template.version, AUDITOR: { email: 'auditor@example.test' } },
    auditorSnapshot: { email: 'auditor@example.test' },
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    clauses,
  };
}

function applyPlanToFixture(contract, plan) {
  for (const change of plan.changes) {
    const row = contract.clauses.find(clause => clause.id === change.clauseId);
    Object.assign(row, change.data);
  }
  for (const create of plan.creates) contract.clauses.push({ id: 'uafe-row', ...create, updatedAt: new Date() });
}

describe('actualización segura del contenido oficial del contrato', () => {
  test('A/B: corrige fragmentos conocidos y conserva fechas, honorarios y contenido manual', () => {
    const contract = fixture();
    contract.clauses.find(row => row.clauseKey === 'p5').body = contract.clauses.find(row => row.clauseKey === 'p5').body.replace('actividad principal es la ', 'actividad principal es ');
    contract.clauses.find(row => row.clauseKey === 'p6').body = contract.clauses.find(row => row.clauseKey === 'p6').body.replace('y Cuenta con la calificación', 'y cuenta con la calificación');
    contract.clauses.find(row => row.clauseKey === 'p33').body = contract.clauses.find(row => row.clauseKey === 'p33').body.replace('Valores y Seguros las normas de carácter tributarlo', 'Valores y Seguros, las normas de carácter tributario');
    contract.clauses.find(row => row.clauseKey === 'p39').body = contract.clauses.find(row => row.clauseKey === 'p39').body.replace('NllF', 'NIIF');
    contract.clauses.find(row => row.clauseKey === 'p54').body = contract.clauses.find(row => row.clauseKey === 'p54').body.replace('Email:', 'E-mail:');
    contract.clauses.find(row => row.clauseKey === 'p55').body = 'Por " El Auditor":  E-mail: auditor@example.test';
    contract.clauses.find(row => row.clauseKey === 'p60').body = contract.clauses.find(row => row.clauseKey === 'p60').body.replace('ciuda1e', 'ciudad de');
    contract.clauses.find(row => row.clauseKey === 'p58').body = 'Fecha de duración personalizada 2030';
    contract.clauses.find(row => row.clauseKey === 'p49').body = 'Honorarios personalizados USD 1234';
    const plan = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(plan.changes.map(change => change.clauseKey)).not.toContain('p58');
    expect(plan.changes.map(change => change.clauseKey)).not.toContain('p49');
    expect(plan.changes.map(change => change.clauseKey)).not.toContain('custom-date');
    expect(plan.changes.map(change => change.clauseKey)).not.toContain('custom-user');
    expect(plan.creates).toHaveLength(1);
    expect(plan.manualReview).toHaveLength(0);
  });

  test('C: correo histórico se mueve/corrige solo usando el snapshot del contrato', () => {
    const contract = fixture();
    const p55 = contract.clauses.find(row => row.clauseKey === 'p55');
    p55.body = 'Por " El Auditor":  Mail: auditor@example.test';
    const plan = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(plan.changes.find(change => change.clauseKey === 'p55').data.body).toBe('Por " El Auditor":  E-mail: auditor@example.test');
    contract.auditorSnapshot = null;
    contract.variables.AUDITOR = undefined;
    p55.body = 'Por " El Auditor":  Mail: someone-else@example.test';
    const withoutSnapshot = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(withoutSnapshot.changes.some(change => change.clauseKey === 'p55')).toBe(false);
    expect(withoutSnapshot.manualReview.some(item => item.clauseKey === 'p55')).toBe(true);
  });

  test('D: recupera p52 solo para el patrón exacto y correo histórico coincidente', () => {
    const contract = fixture();
    const p52 = contract.clauses.find(row => row.clauseKey === 'p52');
    const baseline = template.paragraphs[52];
    p52.body = 'Por " El Auditor":  Mail: auditor@example.test';
    const plan = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(plan.changes.find(change => change.clauseKey === 'p52').data.body).toBe(baseline);
    contract.auditorSnapshot = { email: 'different@example.test' };
    contract.variables.AUDITOR.email = 'different@example.test';
    const mismatch = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(mismatch.changes.some(change => change.clauseKey === 'p52')).toBe(false);
    expect(mismatch.manualReview.some(item => item.clauseKey === 'p52')).toBe(true);
    p52.body = `${baseline} texto personalizado`;
    const customized = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(customized.changes.some(change => change.clauseKey === 'p52')).toBe(false);
  });

  test('D2: aplica la aprobación histórica solo al contrato RCA exacto y sin tocar p53-p57', () => {
    const contract = fixture();
    contract.id = APPROVED_P52_REPAIR_CONTRACT_ID;
    const p52 = contract.clauses.find(row => row.clauseKey === 'p52');
    p52.body = APPROVED_P52_REPAIR_BODY;
    const approved = planOfficialContractContentUpdate(contract, template.paragraphs, {
      verifiedHistoricalP52Email: 'carlos.mendoza.auditor@example.com',
    });
    expect(approved.changes.find(change => change.clauseKey === 'p52').data.body).toBe(template.paragraphs[52]);
    const p52RepairReason = 'Restaurar NOVENA p52: este contrato fue aprobado manualmente y el email coincide con los snapshots históricos de documentos generados del auditor anterior.';
    expect(approved.changes.filter(change => change.reasons.includes(p52RepairReason)).map(change => change.clauseKey)).toEqual(['p52']);
    expect(approved.changes.some(change => ['p53', 'p56', 'p57'].includes(change.clauseKey))).toBe(false);

    const otherContract = fixture();
    otherContract.clauses.find(row => row.clauseKey === 'p52').body = APPROVED_P52_REPAIR_BODY;
    const protectedOther = planOfficialContractContentUpdate(otherContract, template.paragraphs, {
      verifiedHistoricalP52Email: 'carlos.mendoza.auditor@example.com',
    });
    expect(protectedOther.changes.some(change => change.clauseKey === 'p52')).toBe(false);
    expect(protectedOther.manualReview.some(item => item.clauseKey === 'p52')).toBe(true);

    p52.body = `${APPROVED_P52_REPAIR_BODY} `;
    const changedBody = planOfficialContractContentUpdate(contract, template.paragraphs, {
      verifiedHistoricalP52Email: 'carlos.mendoza.auditor@example.com',
    });
    expect(changedBody.changes.some(change => change.clauseKey === 'p52')).toBe(false);
    expect(changedBody.manualReview.some(item => item.clauseKey === 'p52')).toBe(true);
  });

  test('E: agrega UAFE como fila oficial independiente después de p57', () => {
    const contract = fixture();
    const plan = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(plan.creates).toEqual([expect.objectContaining({
      clauseKey: OFFICIAL_UAFE_CLAUSE_KEY, body: OFFICIAL_UAFE_BODY, isCustom: false,
      parentClauseKey: 'p57', sortOrder: contract.clauses.find(row => row.clauseKey === 'p57').sortOrder,
    })]);
  });

  test('F: reclasifica custom-uafe canónico preservando ID, body y orden de la fila', () => {
    const contract = fixture();
    contract.clauses.push({
      id: 'legacy-uafe-id', clauseKey: LEGACY_UAFE_CLAUSE_KEY, title: '', body: OFFICIAL_UAFE_BODY,
      sortOrder: 58, isCustom: true, parentClauseKey: 'p57', updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    const plan = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(plan.creates).toHaveLength(0);
    expect(plan.changes.find(change => change.clauseId === 'legacy-uafe-id').data).toEqual(expect.objectContaining({
      clauseKey: OFFICIAL_UAFE_CLAUSE_KEY, isCustom: false, parentClauseKey: 'p57', sortOrder: 57,
    }));
  });

  test('G: texto UAFE alterado o filas duplicadas quedan para revisión manual', () => {
    const altered = fixture();
    altered.clauses.push({ id: 'altered-uafe', clauseKey: LEGACY_UAFE_CLAUSE_KEY, title: '', body: `${OFFICIAL_UAFE_BODY} editado`, sortOrder: 58, isCustom: true, parentClauseKey: 'p57' });
    expect(planOfficialContractContentUpdate(altered, template.paragraphs).manualReview.some(item => item.clauseKey === LEGACY_UAFE_CLAUSE_KEY)).toBe(true);
    const duplicate = fixture();
    duplicate.clauses.push({ id: 'uafe-one', clauseKey: LEGACY_UAFE_CLAUSE_KEY, title: '', body: OFFICIAL_UAFE_BODY, sortOrder: 58, isCustom: true, parentClauseKey: 'p57' });
    duplicate.clauses.push({ id: 'uafe-two', clauseKey: 'other-uafe', title: '', body: OFFICIAL_UAFE_BODY, sortOrder: 59, isCustom: true, parentClauseKey: 'p57' });
    const duplicatePlan = planOfficialContractContentUpdate(duplicate, template.paragraphs);
    expect(duplicatePlan.creates).toHaveLength(0);
    expect(duplicatePlan.manualReview.some(item => item.clauseKey === OFFICIAL_UAFE_CLAUSE_KEY)).toBe(true);
  });

  test('H: una segunda planificación tras aplicar el plan no propone cambios ni duplica UAFE', () => {
    const contract = fixture();
    applyPlanToFixture(contract, planOfficialContractContentUpdate(contract, template.paragraphs));
    const repeated = planOfficialContractContentUpdate(contract, template.paragraphs);
    expect(repeated.changes).toHaveLength(0);
    expect(repeated.creates).toHaveLength(0);
    expect(repeated.manualReview).toHaveLength(0);
  });

  test('I/J: contratos futuros conservan claves y sortOrder y UAFE es oficial', () => {
    const base = template.paragraphs.map((body, index) => ({ clauseKey: `p${index}`, title: '', body, sortOrder: index }));
    const prepared = prepareNewOfficialContractSections(base);
    const uafe = prepared.find(row => row.clauseKey === OFFICIAL_UAFE_CLAUSE_KEY);
    expect(uafe).toEqual(expect.objectContaining({ isCustom: false, parentClauseKey: 'p57', body: OFFICIAL_UAFE_BODY, sortOrder: 57 }));
    expect(prepared.find(row => row.clauseKey === 'p58').sortOrder).toBe(58);
    expect(prepared.find(row => row.clauseKey === 'p57').sortOrder).toBe(57);
  });
});
