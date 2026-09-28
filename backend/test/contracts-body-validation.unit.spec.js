require('reflect-metadata');
const { plainToInstance } = require('class-transformer');
const { validateSync } = require('class-validator');
const {
  ContractSectionEditDto,
  UpdateContractClauseDto,
  CreateContractClauseDto,
  CreateContractParagraphDto,
} = require('../dist/src/contracts/dto/contracts.dto.js');

const BODY = `PRIMERA. - COMPARECIENTES.  – Intervienen en la celebración del presente Contrato de Servicios profesionales de Auditoría Externa, la compañía SAPRENSOTA S.A.  con   RUC   #   0992488409001, representado por su GERENTE GENERAL, Sr. TOMALA IBARRA CRISTHIAN EGARDO con C.C.  # 0919047902, parte que para los efectos de este contrato se pondrá denominar simplemente como” La Compañía”; y, por otra parte, el auditor externo Lcdo. CPA. Lic. CPA. Wilmer Olmedo Espinoza Toalombo MT, con RUC No. 0916540586001 Registro Nacional de Auditor Externo No. SCVS-RNAE-1872, parte a la que para los efectos de este contrato se podrá denominar como “El Auditor”.
Más adelante en este instrumento a las mencionadas personas se las podrá nombrar conjuntamente consideradas simplemente como “los comparecientes”, “los contratantes” o “las partes".
Los comparecientes antes mencionados, en goce de su capacidad civil para ejercer derechos y contraer obligaciones, por sus propios derechos y por los que representan, convienen en suscribir el   presente    contrato    de   PRESTACION   DE    SERVICIOS PROFESIONALES   DE AUDITORIA EXTERNA. Los contratantes, quedan en común acuerdo, libre y voluntariamente, formulan y convienen en las siguientes estipulaciones:`;

const DTO_CASES = [
  ['ContractSectionEditDto', ContractSectionEditDto, { clauseKey: 'p2' }],
  ['UpdateContractClauseDto', UpdateContractClauseDto, {}],
  ['CreateContractClauseDto', CreateContractClauseDto, { title: 'Cláusula de prueba' }],
  ['CreateContractParagraphDto', CreateContractParagraphDto, {}],
];

function makeDto(Dto, body = BODY, extra = {}) {
  return plainToInstance(Dto, { ...extra, body });
}

describe('validación Unicode de body contractual', () => {
  test.each(DTO_CASES)('%s acepta el texto del reporte y conserva exactamente el body', (_, Dto, extra) => {
    const dto = makeDto(Dto, BODY, extra);

    expect(/^[^\p{Cc}]*$/u.test(BODY)).toBe(false);
    expect(/^[^\p{Cc}]*$/u.test('línea uno\nlínea dos')).toBe(false);
    expect(validateSync(dto)).toEqual([]);
    expect(dto.body).toBe(BODY);
    expect(BODY).toContain('–');
    expect(BODY).toContain('“');
    expect(BODY).toContain('”');
    expect(BODY).toContain('celebración');
    expect(BODY).toContain('compañía');
    expect(BODY).toContain('#');
    expect(BODY).toContain('\n');
  });

  test.each(DTO_CASES)('%s mantiene el límite de 50000 caracteres', (_, Dto, extra) => {
    expect(validateSync(makeDto(Dto, 'á'.repeat(50000), extra))).toEqual([]);
    expect(validateSync(makeDto(Dto, 'á'.repeat(50001), extra)).some(error => error.property === 'body')).toBe(true);
  });

  test.each(DTO_CASES)('%s sigue rechazando caracteres de control no permitidos', (_, Dto, extra) => {
    for (const control of ['\u0000', '\u0007', '\u007F', '\u0085']) {
      const errors = validateSync(makeDto(Dto, `Texto${control}inválido`, extra));
      expect(errors.find(error => error.property === 'body')?.constraints).toHaveProperty('matches');
    }
  });

  test.each(DTO_CASES)('%s admite tabulaciones y saltos CR/LF', (_, Dto, extra) => {
    const body = 'Texto\tcon tabulación\r\ny salto LF\nfinal';
    expect(validateSync(makeDto(Dto, body, extra))).toEqual([]);
    expect(makeDto(Dto, body, extra).body).toBe(body);
  });
});
