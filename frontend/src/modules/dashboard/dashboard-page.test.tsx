import { MemoryRouter } from 'react-router-dom';
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './dashboard-page';
vi.mock('../../app/use-auth', () => ({ useAuth: () => ({ user: { firstName: 'Wilmer' } }) }));
afterEach(() => vi.useRealTimers());
const renderPage = () => render(<MemoryRouter><DashboardPage /></MemoryRouter>);
describe('Dashboard institucional', () => {
 it('presenta la bienvenida y las tres rutas sin estadísticas', () => {
  renderPage();
  expect(screen.getByRole('heading', { name: 'Bienvenido, Wilmer' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /Preparar un contrato/ })).toHaveAttribute('href', '/contracts');
  expect(screen.getByRole('link', { name: /Trabajar con información financiera/ })).toHaveAttribute('href', '/documents');
  expect(screen.getByRole('link', { name: /Preparar un informe/ })).toHaveAttribute('href', '/reports');
  expect(screen.queryByText('Clientes activos')).not.toBeInTheDocument();
 });
 it('actualiza el día en Guayaquil sin recargar, aunque UTC ya esté en el siguiente día', () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-05T04:59:59Z'));
  renderPage(); const date = document.querySelector('time')!;
  expect(date).toHaveTextContent('viernes04septiembre 2026');
  act(() => vi.advanceTimersByTime(1000));
  expect(date).toHaveTextContent('sábado05septiembre 2026');
 });
});
