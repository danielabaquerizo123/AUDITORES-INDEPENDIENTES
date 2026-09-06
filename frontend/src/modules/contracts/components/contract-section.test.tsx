import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ContractSection } from './contract-section';
import type { ContractSummary, ContractValidation } from '../services/contracts.api';

const {
  getContractByPeriod,
  createContract,
  updateContract,
  getValidation,
  generateDocument,
  listDocuments,
  getTemplates,
  hasPermission,
} = vi.hoisted(() => ({
  getContractByPeriod: vi.fn(),
  createContract: vi.fn(),
  updateContract: vi.fn(),
  getValidation: vi.fn(),
  generateDocument: vi.fn(),
  listDocuments: vi.fn(),
  getTemplates: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('../services/contracts.api', () => ({
  contractsApi: {
    getContractByPeriod,
    createContract,
    updateContract,
    getValidation,
    generateDocument,
    listDocuments,
    getTemplates,
    downloadDocument: vi.fn(),
  },
}));

vi.mock('../../clients/services/clients.api', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getApiStatus: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status,
}));

vi.mock('../../../app/use-auth', () => ({ useAuth: () => ({ hasPermission }) }));

const stored: ContractSummary = {
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
  taxReportDeliveryDate: '2025-04-30T00:00:00.000Z',
  informationDeliveryDate: '2025-01-20T00:00:00.000Z',
  draftReportDueDate: '2025-03-01T00:00:00.000Z',
  feeNet: '1500',
  currency: 'USD',
  notes: null,
  template: { id: 't1', name: 'Plantilla Base', version: 1 },
  auditPeriod: { id: 'p25', label: 'Auditoría 2025', fiscalYear: 2025 },
};

const validValidation: ContractValidation = {
  valid: true,
  errors: [],
  warnings: [],
  missing: [],
  unknown: [],
};

const invalidValidation: ContractValidation = {
  valid: false,
  errors: ['El cliente no tiene un representante principal configurado.'],
  warnings: [],
  missing: ['representative.name'],
  unknown: [],
};

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <ContractSection periodId="p25" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ContractSection', () => {
  beforeEach(() => {
    getContractByPeriod.mockReset();
    createContract.mockReset();
    updateContract.mockReset();
    getValidation.mockReset();
    generateDocument.mockReset();
    listDocuments.mockReset();
    getTemplates.mockReset();
    hasPermission.mockReset();
    hasPermission.mockReturnValue(true);
    listDocuments.mockResolvedValue([]);
    getTemplates.mockResolvedValue([{ id: 't1', name: 'Plantilla Base', version: 1 }]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('muestra estado vacío con acción crear', async () => {
    getContractByPeriod.mockRejectedValue({ response: { status: 404 } });
    renderSection();
    expect(await screen.findByText('No existe un contrato para este período.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear contrato' })).toBeInTheDocument();
  });

  it('crea el contrato con la plantilla seleccionada', async () => {
    getContractByPeriod.mockRejectedValue({ response: { status: 404 } });
    createContract.mockResolvedValue(stored);
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Crear contrato' }));
    await userEvent.selectOptions(await screen.findByLabelText(/Plantilla/), 't1');
    await userEvent.type(screen.getByLabelText(/Honorarios/), '1500.00');
    await userEvent.click(screen.getByRole('button', { name: 'Crear contrato' }));
    await vi.waitFor(() => expect(createContract).toHaveBeenCalled());
    expect(createContract).toHaveBeenCalledWith(
      'p25',
      expect.objectContaining({ templateId: 't1', feeNet: '1500.00', currency: 'USD' }),
    );
  });

  it('muestra el contrato existente con vista previa y generación', async () => {
    getContractByPeriod.mockResolvedValue(stored);
    getValidation.mockResolvedValue(validValidation);
    renderSection();
    expect(await screen.findByText('Plantilla Base (v1)')).toBeInTheDocument();
    expect(screen.getByText('C-2025')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Vista previa' })).toHaveAttribute(
      'href',
      '/contracts/ct1/preview',
    );
    expect(await screen.findByText(/Contrato válido/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar Word' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Generar PDF' })).toBeEnabled();
  });

  it('muestra errores de validación y bloquea la generación', async () => {
    getContractByPeriod.mockResolvedValue(stored);
    getValidation.mockResolvedValue(invalidValidation);
    renderSection();
    expect(
      await screen.findByText('El cliente no tiene un representante principal configurado.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generar Word' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Generar PDF' })).toBeDisabled();
  });

  it('oculta crear y generar sin permisos', async () => {
    hasPermission.mockImplementation((permission: string) =>
      ['contracts.create', 'contracts.generate'].includes(permission) ? false : true,
    );
    getContractByPeriod.mockRejectedValue({ response: { status: 404 } });
    renderSection();
    expect(await screen.findByText('No existe un contrato para este período.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Crear contrato' })).not.toBeInTheDocument();
  });

  it('muestra acceso denegado ante 403', async () => {
    getContractByPeriod.mockRejectedValue({ response: { status: 403 } });
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent('Acceso denegado.');
  });
});
