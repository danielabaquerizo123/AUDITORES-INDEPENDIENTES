import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { clientsApi, getApiErrorMessage, type CreateClientPayload, type UpdateClientPayload } from '../services/clients.api';
import { ClientForm } from './client-form';
import { BackToClients, ClientLoadState } from './client-page-state';
import '../../../styles/clients.css';
export function ClientEditor({id}:{id?:string}) {
 const navigate=useNavigate();const cache=useQueryClient();
 const detail=useQuery({queryKey:['clients',id],queryFn:()=>clientsApi.getClient(id!),enabled:!!id});
 const mutation=useMutation({mutationFn:(payload:CreateClientPayload|UpdateClientPayload)=>id?clientsApi.updateClient(id,payload as UpdateClientPayload):clientsApi.createClient(payload as CreateClientPayload),onSuccess:async client=>{await cache.invalidateQueries({queryKey:['clients']});if(id)cache.setQueryData(['clients',id],client);navigate(id?`/clientes/${client.id}`:'/clientes')}});
 if(id&&(detail.isLoading||detail.isError||!detail.data))return <ClientLoadState loading={detail.isLoading} error={detail.error} retry={()=>detail.refetch()}/>;
 return <section className="clients-page" aria-label={id?'Editar cliente':'Nuevo cliente'}><BackToClients/><div className="clients-heading clients-editor-heading"><div><h1>{id?'Editar cliente':'Nuevo cliente'}</h1><p>{id?'Modifique la información de la compañía.':'Registre la información de la compañía y su representante legal.'}</p></div></div><ClientForm key={id??'new'} client={id?detail.data:undefined} isPending={mutation.isPending} serverError={mutation.isError?getApiErrorMessage(mutation.error,'No fue posible guardar el cliente.'):null} onSubmit={payload=>mutation.mutate(payload)}/></section>;
}
