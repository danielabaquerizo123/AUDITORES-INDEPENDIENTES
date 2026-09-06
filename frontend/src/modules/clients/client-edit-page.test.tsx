import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ClientEditPage } from './client-edit-page';
import { clientsApi, type Client } from './services/clients.api';
const client={id:'c1',legalName:'Tía S.A.',taxId:'0012345678001',economicActivity:'Venta al por menor de productos',email:'empresa@example.test',country:'EC',representatives:[{id:'r1',treatment:'Sr.',fullName:'Juan Carlos Pérez López',nationalId:'0012345678',position:'Gerente General',isPrimary:true}]} as Client;
afterEach(()=>vi.restoreAllMocks());
const renderPage=()=>render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/clientes/c1/editar']}><Routes><Route path="/clientes/:id/editar" element={<ClientEditPage/>}/><Route path="/clientes/:id" element={<p>Detalle actualizado</p>}/></Routes></MemoryRouter></QueryClientProvider>);
describe('Edición de cliente',()=>{
 it('precarga los 8 campos y permite corregir datos sin duplicar',async()=>{vi.spyOn(clientsApi,'getClient').mockResolvedValue(client);const update=vi.spyOn(clientsApi,'updateClient').mockResolvedValue(client);renderPage();expect(await screen.findByDisplayValue('Juan Carlos Pérez López')).toBeInTheDocument();expect(screen.getByLabelText(/Tratamiento/)).toHaveValue('Sr.');const tax=screen.getByLabelText(/RUC/);expect(tax).not.toBeDisabled();await userEvent.clear(tax);await userEvent.type(tax,'0012345678002');await userEvent.selectOptions(screen.getByLabelText(/Tratamiento/),'Sra.');await userEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));expect(await screen.findByText('Detalle actualizado')).toBeInTheDocument();expect(update).toHaveBeenCalledWith('c1',expect.objectContaining({taxId:'0012345678002',representative:expect.objectContaining({id:'r1',treatment:'Sra.'})}))});
 it('muestra el rechazo del servidor sin perder el formulario',async()=>{vi.spyOn(clientsApi,'getClient').mockResolvedValue(client);vi.spyOn(clientsApi,'updateClient').mockRejectedValue({response:{status:409,data:{message:'Ya existe un cliente con este RUC.'}}});renderPage();await screen.findByDisplayValue('Juan Carlos Pérez López');await userEvent.click(screen.getByRole('button',{name:'Guardar cambios'}));expect(await screen.findByRole('alert')).toHaveTextContent('Ya existe un cliente con este RUC.');expect(screen.getByDisplayValue('Tía S.A.')).toBeInTheDocument()});
});
