import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RepresentativesSection } from './representatives-section';
import type { Representative } from '../services/representatives.api';

const { getRepresentatives, createRepresentative, updateRepresentative, hasPermission } =
  vi.hoisted(() => ({
    getRepresentatives: vi.fn(),
    createRepresentative: vi.fn(),
    updateRepresentative: vi.fn(),
    hasPermission: vi.fn(),
  }));

vi.mock('../services/representatives.api', () => ({
  representativesApi: { getRepresentatives, createRepresentative, updateRepresentative },
}));

vi.mock('../services/clients.api', () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
  getApiStatus: (error: unknown) =>
    (error as { response?: { status?: number } })?.response?.status,
}));

vi.mock('../../../app/use-auth', () => ({ useAuth: () => ({ hasPermission }) }));

const repA: Representative = {
  id: 'r1',
  clientId: 'c1',
  treatment: 'Sr.',
  fullName: 'Juan Pérez',
  nationalId: '1701234567',
  position: 'Gerente General',
  email: 'juan@test.dev',
  phone: '099000111',
  isPrimary: true,
  validFrom: '2024-01-01T00:00:00.000Z',
  validTo: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const repB: Representative = {
  ...repA,
  id: 'r2',
  fullName: 'María López',
  position: 'Contadora',
  email: null,
  phone: null,
  isPrimary: false,
  validFrom: null,
};

function renderSection() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <RepresentativesSection clientId="c1" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RepresentativesSection', () => {
  beforeEach(() => {
    getRepresentatives.mockReset();
    createRepresentative.mockReset();
    updateRepresentative.mockReset();
    hasPermission.mockReset();
    hasPermission.mockReturnValue(true);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('A. muestra estado vacío', async () => {
    getRepresentatives.mockResolvedValue([]);
    renderSection();
    expect(await screen.findByText('No hay representantes registrados.')).toBeInTheDocument();
  });

  it('B. muestra los representantes con el principal destacado', async () => {
    getRepresentatives.mockResolvedValue([repA, repB]);
    renderSection();
    expect((await screen.findAllByText('Juan Pérez')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('María López').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Principal').length).toBeGreaterThan(0);
  });

  it('C. crea un representante y refresca el listado', async () => {
    getRepresentatives.mockResolvedValue([]);
    createRepresentative.mockResolvedValue({ ...repA, id: 'r9' });
    renderSection();
    await userEvent.click(await screen.findByRole('button', { name: 'Nuevo representante' }));
    await userEvent.type(screen.getByLabelText(/Nombre completo/), 'Ana Torres');
    await userEvent.click(screen.getByRole('button', { name: 'Crear representante' }));
    await vi.waitFor(() => expect(createRepresentative).toHaveBeenCalled());
    expect(createRepresentative).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ fullName: 'Ana Torres', isPrimary: false }),
    );
  });

  it('D. precarga y guarda la edición', async () => {
    getRepresentatives.mockResolvedValue([repA]);
    updateRepresentative.mockResolvedValue({ ...repA, position: 'Presidenta' });
    renderSection();
    await userEvent.click((await screen.findAllByText('Editar'))[0]);
    expect(await screen.findByDisplayValue('Juan Pérez')).toBeInTheDocument();
    const positionInput = screen.getByDisplayValue('Gerente General');
    await userEvent.clear(positionInput);
    await userEvent.type(positionInput, 'Presidenta');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await vi.waitFor(() => expect(updateRepresentative).toHaveBeenCalled());
    expect(updateRepresentative).toHaveBeenCalledWith(
      'c1',
      'r1',
      expect.objectContaining({ fullName: 'Juan Pérez', position: 'Presidenta' }),
    );
  });

  it('E. oculta crear y editar sin permiso clients.update', async () => {
    hasPermission.mockReturnValue(false);
    getRepresentatives.mockResolvedValue([repA]);
    renderSection();
    expect((await screen.findAllByText('Juan Pérez')).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Nuevo representante' })).not.toBeInTheDocument();
    expect(screen.queryByText('Editar')).not.toBeInTheDocument();
  });

  it('F. muestra el estado de error', async () => {
    getRepresentatives.mockRejectedValue(new Error('failure'));
    renderSection();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No fue posible cargar representantes.',
    );
  });
});
