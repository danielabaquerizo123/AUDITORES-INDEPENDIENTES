import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/use-auth';
import { clientsApi, getApiErrorMessage, getApiStatus, type Client } from './services/clients.api';
import { ClientIcon } from './components/client-icon';
import { readModuleSearch,writeModuleSearch } from '../../services/module-search-state';
import '../../styles/clients.css';import '../../styles/module-toast.css';

export function ClientsPage() {
 const {hasPermission}=useAuth(); const cache=useQueryClient(); const location=useLocation(); const [params,setParams]=useSearchParams();
 const saved=readModuleSearch('clients',{q:'',active:false,page:1}); const requestedPage=Math.max(1,Number(params.get('page'))||saved.page||1);
 const [search,setSearch]=useState(saved.q),[applied,setApplied]=useState(saved.active?saved.q:'');
 const [active,setActive]=useState(saved.active),[deleteTarget,setDeleteTarget]=useState<Client|null>(null),[success,setSuccess]=useState<string|null>((location.state as {success?:string}|null)?.success??null);
 useEffect(()=>{if(active)writeModuleSearch('clients',{q:applied,active,page:requestedPage})},[active,applied,requestedPage]);
 const query=useQuery({queryKey:['clients','list',requestedPage,applied],queryFn:({signal})=>clientsApi.getClientPage(requestedPage,applied,signal),enabled:active});
 const remove=useMutation({mutationFn:(id:string)=>clientsApi.deleteClient(id),onSuccess:async()=>{setSuccess('Cliente eliminado correctamente.');setDeleteTarget(null);await cache.invalidateQueries({queryKey:['clients']})}});
 const {items=[],total=0,page=requestedPage,pageSize=5}=query.data??{},pageCount=Math.max(1,Math.ceil(total/pageSize));
 const changePage=(next:number)=>{const updated=new URLSearchParams(params);updated.set('page',String(next));setParams(updated)};
 const runSearch=()=>{const value=search.trim();setApplied(value);setActive(true);setParams({q:value,page:'1'});writeModuleSearch('clients',{q:value,active:true,page:1})};
 const pages=Array.from({length:Math.min(5,pageCount)},(_,i)=>Math.max(1,Math.min(page-2,pageCount-4))+i);
 return <section className="clients-page" aria-label="Clientes">
  <div className="clients-heading"><div><h1>Clientes</h1><p>Empresas registradas en el sistema para sus procesos de auditoría.</p></div>{hasPermission('clients.create')&&<Link className="clients-button clients-button-orange" to="/clientes/nuevo"><ClientIcon name="plus"/>Nuevo cliente</Link>}</div>
  {success&&<p className="clients-success module-toast" role="status">{success}</p>}
  <form className="auditors-search" onSubmit={event=>{event.preventDefault();runSearch()}}><label>Buscar cliente<input aria-label="Buscar cliente" placeholder="Escriba razón social, RUC o representante legal..." value={search} onChange={event=>setSearch(event.target.value)}/></label><button type="submit" className="clients-button clients-button-brown">Buscar</button></form>
  {!active?<div className="clients-table-scroll"><table className="clients-table"><tbody><tr><td className="clients-empty">Realiza una búsqueda para consultar los registros.</td></tr></tbody></table></div>:query.isLoading?<p role="status" className="clients-status">Cargando clientes...</p>:query.isError?<div className="clients-error" role="alert">{getApiStatus(query.error)===403?'Acceso denegado. No tiene permiso para ver clientes.':'No fue posible cargar clientes.'} <button onClick={()=>query.refetch()}>Reintentar</button></div>:<>
   <div className="clients-table-scroll"><table className="clients-table"><thead><tr>{['#','Razón social','RUC','Representante legal','Cargo','Correo','Acciones'].map(label=><th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{items.map((client,index)=>{const rep=client.representatives?.[0];return <tr key={client.id}><td>{(page-1)*pageSize+index+1}</td><td>{client.legalName}</td><td>{client.taxId}</td><td>{rep?.fullName||'—'}</td><td>{rep?.position||'—'}</td><td>{client.email||'—'}</td><td><div className="clients-row-actions"><Link to={"/clientes/"+client.id} aria-label={"Ver "+client.legalName} title="Ver cliente"><ClientIcon name="eye"/></Link>{hasPermission('clients.update')&&<Link to={"/clientes/"+client.id+"/editar"} aria-label={"Editar "+client.legalName} title="Editar cliente"><ClientIcon name="edit"/></Link>}{hasPermission('clients.delete')&&<button type="button" aria-label={"Eliminar "+client.legalName} title="Eliminar cliente" onClick={()=>{setSuccess(null);setDeleteTarget(client)}}><ClientIcon name="trash"/></button>}</div></td></tr>})}{!items.length&&<tr><td colSpan={7} className="clients-empty">No se encontraron registros para la búsqueda realizada.</td></tr>}</tbody></table></div>
   <div className="clients-pagination"><p>Mostrando {total?(page-1)*pageSize+1:0} a {Math.min(page*pageSize,total)} de {total} clientes</p><nav aria-label="Paginación de clientes"><button disabled={page<=1} onClick={()=>changePage(page-1)} aria-label="Página anterior"><ClientIcon name="back"/></button>{pages.map(n=><button key={n} aria-current={n===page?'page':undefined} onClick={()=>changePage(n)}>{n}</button>)}<button disabled={page>=pageCount} onClick={()=>changePage(page+1)} aria-label="Página siguiente"><ClientIcon name="back" className="clients-next"/></button></nav></div>
  </>}
  {deleteTarget&&<div className="clients-modal-backdrop" role="presentation"><section className="clients-modal" role="dialog" aria-modal="true" aria-labelledby="delete-client-title"><h2 id="delete-client-title">Eliminar cliente</h2><p>¿Está seguro de eliminar este cliente?</p>{(deleteTarget._count?.contracts??0)>0&&<p className="clients-delete-warning">Este cliente tiene contratos asociados. Al eliminarlo, esos contratos se conservarán como historial y no podrá crear contratos nuevos para este cliente.</p>}{remove.isError&&<p className="clients-modal-error" role="alert">{getApiErrorMessage(remove.error,'No fue posible eliminar el cliente.')}</p>}<div className="clients-modal-actions"><button type="button" className="clients-button clients-button-outline" disabled={remove.isPending} onClick={()=>setDeleteTarget(null)}>Cancelar</button><button type="button" className="clients-button clients-button-orange" disabled={remove.isPending} onClick={()=>remove.mutate(deleteTarget.id)}>{remove.isPending?'Eliminando...':'Eliminar cliente'}</button></div></section></div>}
 </section>;
}

