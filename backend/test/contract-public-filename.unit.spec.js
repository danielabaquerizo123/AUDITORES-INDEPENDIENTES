const { buildPublicFileName } = require('../dist/src/contracts/documents/contract-document.builder');

describe('contract public download filename', () => {
  test('uses the legal name, audited year, and requested extension', () => {
    expect(buildPublicFileName('RCA', 2026, 'pdf')).toBe('Contrato - RCA - 2026.pdf');
    expect(buildPublicFileName('RCA', 2026, 'docx')).toBe('Contrato - RCA - 2026.docx');
    expect(buildPublicFileName('MARQUIS S.A.', 2025, 'pdf')).toBe('Contrato - MARQUIS S.A. - 2025.pdf');
  });

  test('sanitizes path and header control characters without changing stored names', () => {
    expect(buildPublicFileName('Empresa / Norte:*? S.A.', 2027, 'pdf')).toBe(
      'Contrato - Empresa Norte S.A. - 2027.pdf',
    );
    expect(buildPublicFileName('  ', 2027, 'docx')).toBe('Contrato - Empresa - 2027.docx');
  });
});
