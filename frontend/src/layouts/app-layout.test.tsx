import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AppLayout } from './app-layout';
const logout = vi.fn();
vi.mock('../app/use-auth', () => ({ useAuth: () => ({ user: { firstName: 'Ana', lastName: 'Pérez', email: 'ana@test.dev' }, logout }) }));
describe('AppLayout', () => {
 it.each(['/clientes','/auditores','/contratos'])('oculta la búsqueda global en %s y conserva la cuenta', route => {
  render(<MemoryRouter initialEntries={[route]}><AppLayout /></MemoryRouter>);
  expect(screen.queryByPlaceholderText('Buscar empresa, RUC o documento...')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Notificaciones aún no disponibles')).toBeInTheDocument();
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
 });
 it('conserva identidad y cierre de sesión con siete opciones de navegación', async () => {
  render(<MemoryRouter initialEntries={['/dashboard']}><AppLayout /></MemoryRouter>);
  expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
  expect(screen.getByText('Usuario único')).toBeInTheDocument();
  expect(screen.getByText('AP')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('navigation').querySelectorAll('a')).toHaveLength(7);
  await userEvent.click(screen.getByText('Ana Pérez'));
  await userEvent.click(screen.getByRole('button', { name: 'Salir' })); expect(logout).toHaveBeenCalled();
 });
 it('abre y cierra la navegación móvil', async () => {
  render(<MemoryRouter><AppLayout /></MemoryRouter>);
  const toggle = screen.getByRole('button', { name: 'Abrir navegación' });
  await userEvent.click(toggle); expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await userEvent.keyboard('{Escape}'); expect(toggle).toHaveAttribute('aria-expanded', 'false');
 });
});
