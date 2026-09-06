import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuditPeriodDetailPage } from './audit-period-detail-page';
import type { AuditPeriodWithClient } from './services/audit-periods.api';

const { getAuditPeriod, getContractByPeriod, hasPermission } = vi.hoisted(() => ({
  getAuditPeriod: vi.fn(),
  getContractByPeriod: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('./services/audit-periods.api', () => ({
  auditPeriodsApi: { getAuditPeriod },
}));

vi.mock('../contracts/services/contracts.api', () => ({
  contractsApi: {
    getContractByPeriod,
    getValidation: vi.fn().mockResolvedValue({ valid: true, errors: [], warnings: [], missing: [], unknown: [] }),
    listDocuments: vi.fn().mockResolvedValue([]),
    getTemplates: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../clients/services/clients.api', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getApiStatus: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status,
}));

vi.mock('../../app/use-auth', () => ({ useAuth: () => ({ hasPermission }) }));

const stored: AuditPeriodWithClient = {
  id: 'p25',
  clientId: 'c1',
  label: 'Auditoría 2025',
  fiscalYear: 2025,
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-12-31T00:00:00.000Z',
  status: 'OPEN',
  lockedAt: null,
  closedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  client: {
    id: 'c1',
    legalName: 'Acme S.A.',
    tradeName: null,
    taxId: '1790012345001',
    economicActivity: null,
    email: null,
    phone: null,
    address: null,
    city: null,
    province: null,
    country: 'EC',
    status: 'ACTIVE',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
};

function renderPage() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={['/clients/c1/audit-periods/p25']}>
        <Routes>
          <Route
            path="/clients/:clientId/audit-periods/:periodId"
            element={<AuditPeriodDetailPage />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('AuditPeriodDetailPage', () => {
  beforeEach(() => {
    getAuditPeriod.mockReset();
    getContractByPeriod.mockReset();
    hasPermission.mockReset();
    hasPermission.mockReturnValue(true);
    getContractByPeriod.mockRejectedValue({ response: { status: 404 } });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('G. renderiza el contexto cliente/auditoría y las tabs futuras', async () => {
    getAuditPeriod.mockResolvedValue(stored);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Acme S.A.' })).toBeInTheDocument();
    expect(screen.getAllByText(/Auditoría 2025/).length).toBeGreaterThan(0);
    expect(screen.getByText('2025-01-01')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Contrato' }));
    expect(await screen.findByText('No existe un contrato para este período.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Materialidad' }));
    expect(screen.getByText('Se implementará en una fase posterior.')).toBeInTheDocument();
  });

  it('H. muestra recurso no encontrado ante 404', async () => {
    getAuditPeriod.mockRejectedValue({ response: { status: 404, data: {} } });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Período de auditoría no encontrado.',
    );
  });
});
