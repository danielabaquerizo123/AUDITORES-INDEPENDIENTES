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
    expect(await screen.findByRole('heading', { name: 'Comparecientes' })).toBeInTheDocument();
    expect(screen.getByText('Acme S.A. con RUC 1790012345001.')).toBeInTheDocument();
    expect(screen.getByText('Honorarios 1500 USD.')).toBeInTheDocument();
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
