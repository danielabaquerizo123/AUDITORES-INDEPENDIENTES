import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PeriodsSection } from './periods-section';
import type { AuditPeriod } from '../../audit-periods/services/audit-periods.api';

const { getAuditPeriods, createAuditPeriod, updateAuditPeriod, hasPermission } = vi.hoisted(
  () => ({
    getAuditPeriods: vi.fn(),
    createAuditPeriod: vi.fn(),
    updateAuditPeriod: vi.fn(),
    hasPermission: vi.fn(),
  }),
);

vi.mock('../../audit-periods/services/audit-periods.api', () => ({
  auditPeriodsApi: { getAuditPeriods, createAuditPeriod, updateAuditPeriod },
}));

vi.mock('../services/clients.api', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getApiStatus: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status,
}));

vi.mock('../../../app/use-auth', () => ({ useAuth: () => ({ hasPermission }) }));

const period2024: AuditPeriod = {
  id: 'p24',
  clientId: 'c1',
  label: 'Auditoría 2024',
  fiscalYear: 2024,
  startDate: '2024-01-01T00:00:00.000Z',
  endDate: '2024-12-31T00:00:00.000Z',
  status: 'CLOSED',
  lockedAt: null,
  closedAt: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const period2025: AuditPeriod = {
  ...period2024,
  id: 'p25',
  label: 'Auditoría 2025',
  fiscalYear: 2025,
  startDate: '2025-01-01T00:00:00.000Z',
  endDate: '2025-12-31T00:00:00.000Z',
  status: 'OPEN',
};

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <PeriodsSection clientId="c1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PeriodsSection', () => {
  beforeEach(() => {
    getAuditPeriods.mockReset();
    createAuditPeriod.mockReset();
    updateAuditPeriod.mockReset();
    hasPermission.mockReset();
    hasPermission.mockImplementation((permission: string) => permission !== 'none');
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('A. muestra estado vacío', async () => {
    getAuditPeriods.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText('No hay períodos registrados.')).toBeInTheDocument();
  });

  it('B. muestra los períodos ordenados del más reciente al más antiguo', async () => {
    getAuditPeriods.mockResolvedValue([period2024, period2025]);
    renderSection();
    const years = (await screen.findAllByText(/202[45]/)).map((el) => el.textContent);
    expect(years[0]).toBe('2025');
    expect(years).toContain('2024');
    const links = screen.getAllByRole('link', { name: 'Ver' });
    expect(links[0]).toHaveAttribute('href', '/clients/c1/audit-periods/p25');
  });

  it('C. crea un período y refresca el listado', async () => {
    getAuditPeriods.mockResolvedValue([]);
    createAuditPeriod.mockResolvedValue(period2025);
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo período' }));
    await userEvent.type(screen.getByLabelText(/Etiqueta/), 'Auditoría 2025');
    await userEvent.type(screen.getByLabelText(/Año fiscal/), '2025');
    await userEvent.type(screen.getByLabelText(/Fecha de inicio/), '2025-01-01');
    await userEvent.type(screen.getByLabelText(/Fecha de fin/), '2025-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Crear período' }));
    await vi.waitFor(() => expect(createAuditPeriod).toHaveBeenCalled());
    expect(createAuditPeriod).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ label: 'Auditoría 2025', fiscalYear: 2025 }),
    );
  });

  it('D. rechaza fecha de fin anterior a la de inicio', async () => {
    getAuditPeriods.mockResolvedValue([]);
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo período' }));
    await userEvent.type(screen.getByLabelText(/Etiqueta/), 'Auditoría 2025');
    await userEvent.type(screen.getByLabelText(/Año fiscal/), '2025');
    await userEvent.type(screen.getByLabelText(/Fecha de inicio/), '2025-12-31');
    await userEvent.type(screen.getByLabelText(/Fecha de fin/), '2025-01-01');
    await userEvent.click(screen.getByRole('button', { name: 'Crear período' }));
    expect(
      await screen.findByText('La fecha de fin debe ser posterior a la fecha de inicio'),
    ).toBeInTheDocument();
    expect(createAuditPeriod).not.toHaveBeenCalled();
  });

  it('E. precarga y guarda la edición', async () => {
    getAuditPeriods.mockResolvedValue([period2025]);
    updateAuditPeriod.mockResolvedValue({ ...period2025, label: 'Auditoría 2025 ajustada' });
    renderSection();
    await userEvent.click((await screen.findAllByText('Editar'))[0]);
    expect(await screen.findByDisplayValue('Auditoría 2025')).toBeInTheDocument();
    const labelInput = screen.getByDisplayValue('Auditoría 2025');
    await userEvent.clear(labelInput);
    await userEvent.type(labelInput, 'Auditoría 2025 ajustada');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await vi.waitFor(() => expect(updateAuditPeriod).toHaveBeenCalled());
    expect(updateAuditPeriod).toHaveBeenCalledWith(
      'p25',
      expect.objectContaining({ label: 'Auditoría 2025 ajustada' }),
    );
  });

  it('F. oculta crear y editar sin permisos', async () => {
    hasPermission.mockImplementation((permission: string) =>
      ['periods.create', 'periods.update'].includes(permission) ? false : true,
    );
    getAuditPeriods.mockResolvedValue([period2025]);
    renderSection();
    expect((await screen.findAllByText(/2025/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Nuevo período' })).not.toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
  });
});
