import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientDetailPage } from './client-detail-page';
import { clientsApi, type Client } from './services/clients.api';
vi.mock('../../app/use-auth',()=>({useAuth:()=>({hasPermission:()=>true})}));
afterEach(()=>vi.restoreAllMocks());
const renderPage=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/clientes/c1']}><Routes><Route path="/clientes/:id" element={<ClientDetailPage/>}/></Routes></MemoryRouter></QueryClientProvider>);
describe('Detalle de cliente',()=>{
 it('muestra los 8 datos en bloques con navegación independiente',async()=>{vi.spyOn(clientsApi,'getClient').mockResolvedValue({id:'c1',legalName:'Tía S.A.',taxId:'0012345678001',economicActivity:'Venta al por menor de productos',email:'empresa@example.test',representatives:[{treatment:'Sra.',fullName:'María Pérez',nationalId:'0012345678',position:'Gerente General'}]} as Client);renderPage();expect(await screen.findByRole('heading',{name:'Tía S.A.'})).toBeInTheDocument();expect(screen.getByText('Venta al por menor de productos')).toBeInTheDocument();expect(screen.getByText('empresa@example.test')).toBeInTheDocument();expect(screen.getByText('Sra.')).toBeInTheDocument();expect(screen.getByText('María Pérez')).toBeInTheDocument();expect(screen.getByText('Gerente General')).toBeInTheDocument();expect(screen.queryByText('Teléfono')).not.toBeInTheDocument();expect(screen.queryByText('Dirección')).not.toBeInTheDocument();expect(screen.getByRole('link',{name:'Editar cliente'})).toHaveAttribute('href','/clientes/c1/editar');expect(screen.getByRole('link',{name:'Volver a clientes'})).toHaveAttribute('href','/clientes');expect(screen.queryByRole('tablist')).not.toBeInTheDocument()});
 it('maneja un cliente inexistente',async()=>{vi.spyOn(clientsApi,'getClient').mockRejectedValue({response:{status:404}});renderPage();expect(await screen.findByRole('alert')).toHaveTextContent('Cliente no encontrado.')});
});
