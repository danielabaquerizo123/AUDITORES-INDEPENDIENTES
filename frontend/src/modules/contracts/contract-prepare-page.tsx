import { useEffect,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Link,useNavigate } from 'react-router-dom';
import { clientsApi } from '../clients/services/clients.api';
import { contractsApi } from './services/contracts.api';
import { BackToContracts,ContractError } from './components/contract-ui';
import '../../styles/contracts.css';
export function ContractPreparePage(){
 useEffect(()=>{window.scrollTo(0,0)},[]);
 const [search,setSearch]=useState(''),[clientId,setClientId]=useState(''),[year,setYear]=useState('');const navigate=useNavigate(),cache=useQueryClient();
 const query=useQuery({queryKey:['clients','contract-picker'],queryFn:clientsApi.getClients});
 const client=query.data?.find(c=>c.id===clientId),rep=client?.representatives?.[0];
 const items=(query.data??[]).filter(c=>c.legalName.toLocaleLowerCase('es').includes(search.toLocaleLowerCase('es'))||c.taxId.includes(search));
 const mutation=useMutation({mutationFn:()=>contractsApi.prepareOfficial(clientId,Number(year)),onSuccess:async c=>{await cache.invalidateQueries({queryKey:['contracts']});navigate(`/contratos/${c.id}/editar`)}});
 return <section className="contracts-page"><BackToContracts/><header className="contracts-heading contract-detail-heading"><h1>Preparar contrato</h1><p>Seleccione un cliente y el año auditado para preparar la plantilla oficial.</p></header><form className="contract-editor-card" onSubmit={e=>{e.preventDefault();mutation.mutate()}}><fieldset disabled={mutation.isPending}><div className="contract-prepare-fields"><label>Buscar empresa<input placeholder="Escriba razón social o RUC..." value={search} onChange={e=>setSearch(e.target.value)}/></label><label>Año auditado<input required type="number" min="1900" max="2200" placeholder="Ej. 2026" value={year} onChange={e=>setYear(e.target.value)}/></label></div><label>Cliente<select required value={clientId} onChange={e=>setClientId(e.target.value)}><option value="">Seleccione un cliente</option>{client&&!items.some(c=>c.id===client.id)&&<option value={client.id}>{client.legalName} — {client.taxId}</option>}{items.map(c=><option key={c.id} value={c.id}>{c.legalName} — {c.taxId}</option>)}</select></label>{query.isPending&&<p role="status">Cargando clientes...</p>}{query.isError&&<ContractError error={query.error}/>} {!query.isPending&&!query.isError&&!query.data?.length&&<p>No hay clientes registrados. <Link to="/clientes/nuevo">Registrar cliente</Link></p>}
 {client&&<div className="contract-client-summary"><h2>Datos del cliente</h2><dl>{[['Razón social',client.legalName],['RUC',client.taxId],['Actividad económica',client.economicActivity],['Correo electrónico',client.email],['Tratamiento',rep?.treatment],['Representante legal',rep?.fullName],['Cédula',rep?.nationalId],['Cargo',rep?.position]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl></div>}
 <p className="contract-review-note">Los honorarios, plazos, domicilios y fechas conservan el contenido de la plantilla. Revise y edite estos datos antes de generar el contrato.</p>{mutation.isError&&<ContractError error={mutation.error}/>}<div className="contract-form-actions"><Link className="contract-button contract-outline" to="/contratos">Cancelar</Link><button disabled={!client||mutation.isPending} className="contract-button contract-primary">{mutation.isPending?'Preparando...':'Preparar y revisar'}</button></div></fieldset></form></section>
}
