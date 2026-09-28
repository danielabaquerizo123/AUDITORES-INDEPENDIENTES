import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractPreviewPage } from './contract-preview-page';
import type { ContractPreview } from './services/contracts.api';

const { getPreview } = vi.hoisted(() => ({ getPreview: vi.fn() }));

vi.mock('./services/contracts.api', () => ({
  contractsApi: { getPreview },
}));

vi.mock('../clients/services/clients.api', () => ({
  getApiStatus: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status,
}));

const stored: ContractPreview = {
  contract: {
    id: 'ct1',
    clientId: 'c1',
    auditPeriodId: 'p25',
    templateId: 't1',
    contractNumber: 'C-2025',
    status: 'DRAFT',
    signingDate: '2025-02-01T00:00:00.000Z',
    effectiveFrom: '2025-01-01T00:00:00.000Z',
    effectiveTo: '2025-12-31T00:00:00.000Z',
    reportDeliveryDate: '2025-03-15T00:00:00.000Z',
    taxReportDeliveryDate: null,
    informationDeliveryDate: null,
    draftReportDueDate: null,
    feeNet: '1500',
    feeWords: 'Mil quinientos dólares americanos con 00/100',
    currency: 'USD',
    notes: null,
    client: { id: 'c1', legalName: 'Acme S.A.', taxId: '1790012345001' },
    auditPeriod: { id: 'p25', label: 'Auditoría 2025', fiscalYear: 2025 },
  },
  sections: [
    { clauseKey: 'p0', title: 'Título corto', body: 'CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES DE AUDITORIA EXTERNA' },
    { clauseKey: 'p1', title: 'Título del contrato', body: 'CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES DE AUDITORIA EXTERNA A LOS ESTADOS FINANCIEROS POR EL AÑO TERMINADO AL 31 DE DICIEMBRE DEL 2025' },
    { clauseKey: 'p2', title: 'Primera', body: 'PRIMERA. - COMPARECIENTES.' },
    { clauseKey: 'a', title: 'Comparecientes', body: 'Acme S.A. con RUC 1790012345001.' },
    { clauseKey: 'b', title: 'Honorarios', body: 'Honorarios 1500 USD.' },
  ],
  validation: { valid: true, errors: [], warnings: [], missing: [], unknown: [] },
};

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/contracts/ct1/preview']}>
        <Routes>
          <Route path="/contracts/:id/preview" element={<ContractPreviewPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContractPreviewPage', () => {
  beforeEach(() => {
    getPreview.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('renderiza las cláusulas con variables resueltas', async () => {
    getPreview.mockResolvedValue(stored);
    renderPage();
    expect(await screen.findByText(/DICIEMBRE DEL 2025/)).toBeInTheDocument();
    expect(screen.queryByText('CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES DE AUDITORIA EXTERNA')).not.toBeInTheDocument();
    expect(screen.getByText('PRIMERA. - COMPARECIENTES.')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Comparecientes' })).toBeInTheDocument();
    expect(screen.getByText('Acme S.A. con RUC 1790012345001.')).toBeInTheDocument();
    expect(screen.getByText('Honorarios 1500 USD.')).toBeInTheDocument();
  });

  it('centra p1 y justifica todo el cuerpo, incluidos párrafos internos, UAFE y texto manual', async () => {
    const sections = [
      ...stored.sections,
      { clauseKey: 'p57-uafe', title: 'UAFE', body: 'Texto oficial UAFE.' },
      { clauseKey: 'manual-1', title: '', body: 'Párrafo agregado por el usuario.' },
    ].map(section => section.clauseKey === 'p1'
      ? { ...section, body: 'Encabezado p1.' }
      : section.clauseKey === 'p2'
        ? { ...section, body: 'PRIMERA. Texto principal.\nPárrafo interno.' }
        : section);
    getPreview.mockResolvedValue({ ...stored, sections });
    renderPage();

    expect(await screen.findByText('Encabezado p1.')).toHaveClass('contract-text-header');
    expect(screen.getByText('PRIMERA. Texto principal.')).toHaveClass('contract-text-body');
    expect(screen.getByText('Párrafo interno.')).toHaveClass('contract-text-body');
    expect(screen.getByText('Texto oficial UAFE.')).toHaveClass('contract-text-body');
    expect(screen.getByText('Párrafo agregado por el usuario.')).toHaveClass('contract-text-body');
  });

  it('muestra en vista previa el año persistido en p1 aunque difiera del año auditado', async () => {
    getPreview.mockResolvedValue({
      ...stored,
      sections: stored.sections.map(section => section.clauseKey === 'p1'
        ? { ...section, body: section.body.replace('2025', '2027') }
        : section),
    });
    renderPage();
    expect(await screen.findByText(/DICIEMBRE DEL 2027/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Contrato de auditoría 2025/ })).toBeInTheDocument();
  });

  it('destaca los errores de validación', async () => {
    getPreview.mockResolvedValue({
      ...stored,
      validation: {
        valid: false,
        errors: ['El cliente no tiene un representante principal configurado.'],
        warnings: [],
        missing: ['representative.name'],
        unknown: [],
      },
    });
    renderPage();
    expect(
      await screen.findByText('El cliente no tiene un representante principal configurado.'),
    ).toBeInTheDocument();
  });

  it('muestra contrato no encontrado ante 404', async () => {
    getPreview.mockRejectedValue({ response: { status: 404 } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Contrato no encontrado.');
  });
});
