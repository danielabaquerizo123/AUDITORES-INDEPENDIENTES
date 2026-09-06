import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FinancialSection } from './financial-section';
import type { FinancialImport, FinancialStatement } from '../services/financial-statements.api';

const { listImports, uploadImport, processImport, getImport, getStatements, getCatalog, reclassifyLine, hasPermission } =
  vi.hoisted(() => ({
    listImports: vi.fn(),
    uploadImport: vi.fn(),
    processImport: vi.fn(),
    getImport: vi.fn(),
    getStatements: vi.fn(),
    getCatalog: vi.fn(),
    reclassifyLine: vi.fn(),
    hasPermission: vi.fn(),
  }));

vi.mock('../services/financial-statements.api', () => ({
  IMPORT_STATUS_LABELS: {
    UPLOADED: 'Subido',
    PROCESSING: 'Procesando',
    REVIEW_REQUIRED: 'Requiere revisión',
    PROCESSED: 'Procesado',
    FAILED: 'Fallido',
  },
  STATEMENT_LABELS: {
    FINANCIAL_POSITION: 'Situación Financiera',
    COMPREHENSIVE_INCOME: 'Resultados',
    CHANGES_IN_EQUITY: 'Cambios en Patrimonio',
    CASH_FLOW: 'Flujo de Efectivo',
  },
  financialStatementsApi: { listImports, uploadImport, processImport, getImport, getStatements, getCatalog, reclassifyLine },
  formatAmount: (value: string | null) => (value === null ? '—' : value),
  formatPercent: (value: string | null) => (value === null ? '—' : `${value} %`),
  formatFileSize: (bytes: number | null) => (bytes === null ? '—' : `${bytes} B`),
}));

vi.mock('../../clients/services/clients.api', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getApiStatus: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status,
}));

vi.mock('../../../app/use-auth', () => ({ useAuth: () => ({ hasPermission }) }));

function baseImport(partial: Partial<FinancialImport> = {}): FinancialImport {
  return {
    id: 'imp1',
    auditPeriodId: 'p25',
    uploadedById: 'u1',
    originalFileName: 'estados.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    sizeBytes: 1234,
    sha256: 'a'.repeat(64),
    status: 'UPLOADED',
    version: 1,
    attemptCount: 0,
    currentYear: null,
    previousYear: null,
    processingError: null,
    detectionSummary: null,
    validationIssues: null,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...partial,
  };
}

const processedImport: FinancialImport = baseImport({
  status: 'PROCESSED',
  currentYear: 2025,
  previousYear: 2024,
  detectionSummary: [
    {
      type: 'FINANCIAL_POSITION',
      sheetName: 'Situación',
      confidence: 1,
      currentYear: 2025,
      previousYear: 2024,
      lineCount: 2,
      unclassified: 1,
    },
  ],
  validationIssues: [],
});

const positionStatement: FinancialStatement = {
  id: 'st1',
  type: 'FINANCIAL_POSITION',
  sheetName: 'Situación',
  currentYear: 2025,
  previousYear: 2024,
  detected: true,
  confidence: 1,
  lineCount: 2,
  lines: [
    {
      id: 'l1',
      sortOrder: 1,
      rawLabel: 'TOTAL DE ACTIVOS',
      normalizedKey: 'financial_position.total_assets',
      classified: true,
      classificationSource: 'AUTO',
      sheetName: 'Situación',
      sourceRow: 5,
      currentValue: '5000',
      previousValue: '4800',
      difference: '200',
      percentageChange: '4.1667',
    },
    {
      id: 'l2',
      sortOrder: 2,
      rawLabel: 'Rubro misterioso XYZ',
      normalizedKey: null,
      classified: false,
      classificationSource: 'AUTO',
      sheetName: 'Situación',
      sourceRow: 6,
      currentValue: '100',
      previousValue: '90',
      difference: '10',
      percentageChange: '11.1111',
    },
  ],
};

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <FinancialSection periodId="p25" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('FinancialSection', () => {
  beforeEach(() => {
    listImports.mockReset();
    uploadImport.mockReset();
    processImport.mockReset();
    getImport.mockReset();
    getStatements.mockReset();
    getCatalog.mockReset();
    reclassifyLine.mockReset();
    hasPermission.mockReset();
    hasPermission.mockReturnValue(true);
    getImport.mockResolvedValue(processedImport);
    getStatements.mockResolvedValue([positionStatement]);
    getCatalog.mockResolvedValue({
      FINANCIAL_POSITION: ['financial_position.total_assets', 'financial_position.cash_and_equivalents'],
      COMPREHENSIVE_INCOME: [],
      CHANGES_IN_EQUITY: [],
      CASH_FLOW: [],
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('muestra estado vacío sin archivos', async () => {
    listImports.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText('Aún no hay archivos cargados para este período.')).toBeInTheDocument();
    expect(screen.getByLabelText('Seleccionar archivo Excel')).toBeInTheDocument();
  });

  it('carga, procesa y muestra comparativo con tabs', async () => {
    listImports.mockResolvedValue([]);
    uploadImport.mockResolvedValue(baseImport());
    processImport.mockResolvedValue({ id: 'imp1', status: 'PROCESSED', issues: [], statements: [] });
    renderSection();
    await screen.findByText('Aún no hay archivos cargados para este período.');
    const input = screen.getByLabelText('Seleccionar archivo Excel');
    fireEvent.change(input, { target: { files: [new File(['x'], 'estados.xlsx')] } });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar estados financieros' }));
    expect(await screen.findByText('TOTAL DE ACTIVOS')).toBeInTheDocument();
    expect(uploadImport).toHaveBeenCalled();
    expect(processImport).toHaveBeenCalledWith('imp1');
    expect(screen.getByRole('tab', { name: 'Situación Financiera' })).toBeInTheDocument();
    expect(screen.getByText('5000')).toBeInTheDocument();
    expect(screen.getByText('4.1667 %')).toBeInTheDocument();
  });

  it('muestra error de carga inválida', async () => {
    listImports.mockResolvedValue([]);
    uploadImport.mockRejectedValue({ response: { status: 400, data: { message: 'Extensión no permitida' } } });
    renderSection();
    await screen.findByText('Aún no hay archivos cargados para este período.');
    fireEvent.change(screen.getByLabelText('Seleccionar archivo Excel'), {
      target: { files: [new File(['x'], 'malo.txt')] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cargar estados financieros' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible cargar el archivo.',
    );
  });

  it('muestra revisión requerida y líneas sin clasificar', async () => {
    listImports.mockResolvedValue([
      baseImport({ status: 'REVIEW_REQUIRED', validationIssues: [{ code: 'BALANCE_MISMATCH', message: 'ACTIVO ≠ PASIVO + PATRIMONIO' }] }),
    ]);
    const reviewImport = baseImport({
      status: 'REVIEW_REQUIRED',
      validationIssues: [{ code: 'BALANCE_MISMATCH', message: 'ACTIVO ≠ PASIVO + PATRIMONIO' }],
      detectionSummary: processedImport.detectionSummary,
    });
    getImport.mockResolvedValue(reviewImport);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    expect(await screen.findByText(/ACTIVO ≠ PASIVO/)).toBeInTheDocument();
    expect(screen.getAllByText('Requiere revisión').length).toBeGreaterThanOrEqual(2);
  });

  it('oculta carga sin financial.import y niega sin financial.read', async () => {
    hasPermission.mockImplementation((permission: string) => permission !== 'financial.import');
    listImports.mockResolvedValue([]);
    const { unmount } = renderSection();
    await screen.findByText('Aún no hay archivos cargados para este período.');
    expect(screen.queryByLabelText('Seleccionar archivo Excel')).not.toBeInTheDocument();
    unmount();

    hasPermission.mockImplementation((permission: string) => permission !== 'financial.read');
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Acceso denegado. No tiene permiso para ver estados financieros.',
    );
  });

  it('abre el selector y guarda la clasificación manual', async () => {
    listImports.mockResolvedValue([baseImport({ status: 'PROCESSED' })]);
    reclassifyLine.mockResolvedValue({ id: 'l2', importStatus: 'PROCESSED' });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Clasificar' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Rubro misterioso XYZ')).toBeInTheDocument();
    await screen.findByRole('option', { name: 'financial_position.cash_and_equivalents' });
    fireEvent.change(screen.getByLabelText('Clave canónica'), {
      target: { value: 'financial_position.cash_and_equivalents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await screen.findByText('TOTAL DE ACTIVOS');
    await vi.waitFor(() =>
      expect(reclassifyLine).toHaveBeenCalledWith('l2', 'financial_position.cash_and_equivalents'),
    );
  });

  it('permite reclasificar una línea ya clasificada', async () => {
    listImports.mockResolvedValue([baseImport({ status: 'PROCESSED' })]);
    reclassifyLine.mockResolvedValue({ id: 'l1', importStatus: 'PROCESSED' });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Reclasificar' }));
    const redialog = await screen.findByRole('dialog');
    expect(redialog.getAttribute('aria-label')).toBe('Clasificar TOTAL DE ACTIVOS');
    expect(within(redialog).getByText('TOTAL DE ACTIVOS')).toBeInTheDocument();
    await screen.findByRole('option', { name: 'financial_position.cash_and_equivalents' });
    const freshDialog = await screen.findByRole('dialog');
    const saveBtn = within(freshDialog).getByRole('button', { name: 'Guardar' });
    expect(saveBtn).toBeEnabled();
    fireEvent.click(saveBtn);
    await vi.waitFor(() =>
      expect(reclassifyLine).toHaveBeenCalledWith('l1', 'financial_position.total_assets'),
    );
  });

  it('muestra error si la API rechaza la clasificación', async () => {
    listImports.mockResolvedValue([baseImport({ status: 'PROCESSED' })]);
    reclassifyLine.mockRejectedValue({ response: { status: 400 } });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Clasificar' }));
    await screen.findByRole('option', { name: 'financial_position.cash_and_equivalents' });
    fireEvent.change(await screen.findByLabelText('Clave canónica'), {
      target: { value: 'financial_position.cash_and_equivalents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible guardar la clasificación.',
    );
  });

  it('oculta Clasificar sin financial.update', async () => {
    hasPermission.mockImplementation((permission: string) => permission !== 'financial.update');
    listImports.mockResolvedValue([baseImport({ status: 'PROCESSED' })]);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    expect(await screen.findByText('TOTAL DE ACTIVOS')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Clasificar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reclasificar' })).not.toBeInTheDocument();
  });

  it('filtra líneas sin clasificar y muestra badge manual', async () => {
    const manualStatement = {
      ...positionStatement,
      lines: positionStatement.lines.map((line) =>
        line.id === 'l2'
          ? { ...line, classified: true, normalizedKey: 'financial_position.cash_and_equivalents', classificationSource: 'MANUAL' as const }
          : line,
      ),
    };
    getStatements.mockResolvedValue([manualStatement]);
    listImports.mockResolvedValue([baseImport({ status: 'PROCESSED' })]);
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    expect(await screen.findByText('Manual')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sin clasificar' }));
    expect(screen.queryByText('TOTAL DE ACTIVOS')).not.toBeInTheDocument();
    expect(screen.queryByText('Rubro misterioso XYZ')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clasificadas manualmente' }));
    expect(screen.getByText('Rubro misterioso XYZ')).toBeInTheDocument();
    expect(screen.queryByText('TOTAL DE ACTIVOS')).not.toBeInTheDocument();
  });

  it('refleja PROCESSED cuando el backend lo confirma tras reclasificar', async () => {
    const reviewImport = baseImport({ status: 'REVIEW_REQUIRED', validationIssues: [] });
    listImports.mockResolvedValue([reviewImport]);
    getImport
      .mockResolvedValueOnce(reviewImport)
      .mockResolvedValue(baseImport({ status: 'PROCESSED' }));
    reclassifyLine.mockResolvedValue({ id: 'l2', importStatus: 'PROCESSED' });
    renderSection();
    fireEvent.click(await screen.findByRole('button', { name: 'Ver' }));
    expect(await screen.findByText('Este archivo requiere revisión.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clasificar' }));
    await screen.findByRole('option', { name: 'financial_position.cash_and_equivalents' });
    fireEvent.change(await screen.findByLabelText('Clave canónica'), {
      target: { value: 'financial_position.cash_and_equivalents' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(await screen.findByText('Estado: Procesado', { exact: false })).toBeInTheDocument();
  });
});
