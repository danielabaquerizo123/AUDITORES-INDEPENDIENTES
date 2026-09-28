import { useState } from 'react';
import { useToast } from '../../app/use-toast';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { contractsApi, type ContractSummary } from './services/contracts.api';
import { clientsApi, getApiErrorMessage, type Client } from '../clients/services/clients.api';
import { ClientIcon } from '../clients/components/client-icon';
import { ContractError, GenerateMenu, SearchIcon } from './components/contract-ui';
import { auditorsApi,type Auditor } from '../auditors/services/auditors.api';
import '../../styles/contracts.css';
type Row={kind:'contract';contract:ContractSummary}|{kind:'client';client:Client;year:number};
const PAGE_SIZE=5;
export function ContractsPage(){
 const {showToast}=useToast();
 const [params,setParams]=useSearchParams();const [search,setSearch]=useState(''),[year,setYear]=useState(''),[applied,setApplied]=useState({q:'',year:''}),[active,setActive]=useState(true);
 const cache=useQueryClient();const currentYear=new Date().getFullYear();
 const query=useQuery({queryKey:['contracts','search',applied.q,applied.year],queryFn:contractsApi.listContracts,enabled:active});
 const q=applied.q.trim(), y=applied.year;
 const clientsQuery=useQuery({queryKey:['clients','contract-search',q],queryFn:async({signal})=>{const first=await clientsApi.getClientPage(1,q,signal);const pageCount=Math.ceil(first.total/first.pageSize);if(pageCount<=1)return first;const rest=await Promise.all(Array.from({length:pageCount-1},(_,index)=>clientsApi.getClientPage(index+2,q,signal)));return {...first,items:[...first.items,...rest.flatMap(page=>page.items)]}},enabled:q.length>0});
 const [preparing,setPreparing]=useState<string|null>(null);
 const [auditorTarget,setAuditorTarget]=useState<ContractSummary|null>(null),[selectedAuditor,setSelectedAuditor]=useState('');
 const auditors=useQuery({queryKey:['auditors','contract-selector'],queryFn:()=>auditorsApi.list(1,''),enabled:!!auditorTarget});
 const assign=useMutation({mutationFn:({id,auditorId}:{id:string;auditorId:string})=>contractsApi.assignAuditor(id,auditorId),onSuccess:async()=>{setAuditorTarget(null);setSelectedAuditor('');showToast('Auditor asignado correctamente.','success');await cache.invalidateQueries({queryKey:['contracts']})},onError:error=>showToast(getApiErrorMessage(error,'No fue posible asignar el auditor.'),'error')});
 const mutation=useMutation({mutationFn:({clientId,auditedYear}:{clientId:string;auditedYear:number})=>contractsApi.prepareOfficial(clientId,auditedYear),onSuccess:async()=>{setPreparing(null);showToast('Contrato registrado correctamente. Puede localizarlo utilizando el buscador.','success');await cache.invalidateQueries({queryKey:['contracts']})},onError:async e=>{setPreparing(null);showToast(getApiErrorMessage(e,'No fue posible preparar el contrato.'),'error');await query.refetch()}});
 function prepare(clientId:string,auditedYear:number){setPreparing(clientId);mutation.mutate({clientId,auditedYear})}
 const all=query.data??[], years=[...new Set([...all.map(c=>c.auditPeriod?.fiscalYear).filter((v):v is number=>!!v),currentYear])].sort((a,b)=>b-a);
 let rows:Row[];
 if(q){
  const matched=clientsQuery.data?.items??[];
  rows=[];
  for(const client of matched){
   const mine=all.filter(c=>c.clientId===client.id&&(!y||String(c.auditPeriod?.fiscalYear)===y));
   if(y){const exact=mine.find(c=>c.auditPeriod?.fiscalYear===Number(y));rows.push(exact?{kind:'contract',contract:exact}:{kind:'client',client,year:Number(y)})}
   else if(!mine.length)rows.push({kind:'client',client,year:currentYear});
   else for(const contract of mine)rows.push({kind:'contract',contract});
  }
 }else rows=all.filter(c=>!y||String(c.auditPeriod?.fiscalYear)===y).map(contract=>({kind:'contract' as const,contract}));
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE)),page=Math.min(pages,Math.max(1,Number(params.get('page'))||1)),visible=rows.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),pageWindowStart=Math.max(1,Math.min(page-2,pages-4)),pageNumbers=Array.from({length:Math.min(5,pages)},(_,index)=>pageWindowStart+index);
 function go(p:number){const next=new URLSearchParams(params);next.set('page',String(p));setParams(next)}
 function applyFilters(next:{q:string;year:string}){setApplied(next);setActive(true);setParams({...next,page:'1'})}
 const loading=query.isPending||(q.length>0&&clientsQuery.isPending);
 return <section className="contracts-page"><header className="contracts-heading"><h1>Contratos</h1><p>Consulta, edita y genera los contratos de auditoría de tus clientes.</p></header>
 <form className="contracts-filters" onSubmit={e=>{e.preventDefault();applyFilters({q:search.trim(),year})}}><label>Buscar empresa<div className="contract-search"><SearchIcon/><input placeholder="Escriba razón social o RUC..." value={search} onChange={e=>setSearch(e.target.value)}/></div></label><label>Año auditado<select value={year} onChange={e=>{setYear(e.target.value);applyFilters({q:search.trim(),year:e.target.value})}} aria-label="Año auditado"><option value="">Todos</option>{years.map(v=><option key={v} value={v}>{v}</option>)}</select></label><button className="contract-button contract-primary" type="submit"><SearchIcon/>Buscar</button></form>
 <div className="contracts-table-card">{query.isError?<><ContractError error={query.error}/><button className="contract-button contract-outline" onClick={()=>void query.refetch()}>Reintentar</button></>:<>{q.length>0&&clientsQuery.isError&&<ContractError error={clientsQuery.error}/>}<div className="contracts-table-scroll"><table className="contracts-table"><thead><tr>{['#','Empresa','RUC','Año auditado','Tipo de contrato','Auditor','Acciones'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((row,i)=>{const n=(page-1)*PAGE_SIZE+i+1;return row.kind==='contract'?<tr key={row.contract.id}><td>{n}</td><td>{row.contract.client?.legalName}</td><td>{row.contract.client?.taxId}</td><td>{row.contract.auditPeriod?.fiscalYear}</td><td>Auditoría Externa</td><td><button className="contract-auditor-select" onClick={()=>{setAuditorTarget(row.contract);setSelectedAuditor(row.contract.auditorId??'')}}>{row.contract.auditor?`${row.contract.auditor.professionalTitles} ${row.contract.auditor.fullName} ▼`:'Seleccionar auditor ▼'}</button></td><td><div className="contract-actions"><Link className="contract-button contract-outline" to={`/contratos/${row.contract.id}`} aria-label={`Ver contrato de ${row.contract.client?.legalName}`}><ClientIcon name="eye"/></Link><Link className="contract-button contract-outline" to={`/contratos/${row.contract.id}/editar`} aria-label={`Editar contrato de ${row.contract.client?.legalName}`}><ClientIcon name="edit"/></Link><GenerateMenu id={row.contract.id}/></div></td></tr>:<tr key={`client-${row.client.id}`}><td>{n}</td><td>{row.client.legalName}</td><td>{row.client.taxId}</td><td>{row.year}</td><td>Sin contrato</td><td>—</td><td><div className="contract-actions"><button className="contract-button contract-primary contract-text-button" disabled={preparing===row.client.id} onClick={()=>prepare(row.client.id,row.year)} aria-label={`Preparar contrato de ${row.client.legalName} ${row.year}`}>{preparing===row.client.id?'Preparando...':'Preparar contrato'}</button></div></td></tr>})}{!visible.length&&<tr><td colSpan={7} className="contracts-empty">{loading?'Cargando contratos...':'No se encontraron registros para la búsqueda realizada.'}</td></tr>}</tbody></table></div><div className="contracts-pagination"><p>Mostrando {rows.length?(page-1)*PAGE_SIZE+1:0} a {Math.min(page*PAGE_SIZE,rows.length)} de {rows.length} resultados</p><nav aria-label="Paginación de contratos"><button disabled={page<=1} onClick={()=>go(page-1)} aria-label="Página anterior">‹</button>{pageNumbers.map(number=><button key={number} aria-current={page===number?'page':undefined} onClick={()=>go(number)}>{number}</button>)}<button disabled={page>=pages} onClick={()=>go(page+1)} aria-label="Página siguiente">›</button></nav></div></>}</div>{auditorTarget&&<div className="clients-modal-backdrop"><section className="clients-modal"><h2>{auditorTarget.auditorId?'Cambiar auditor del contrato':'Asignar auditor'}</h2>{auditorTarget.auditorId&&<p>Se reemplazarán los datos profesionales del auditor en todas las secciones vinculadas del contrato, incluidos cláusulas, firma y bloque profesional del documento.</p>}<select value={selectedAuditor} onChange={e=>setSelectedAuditor(e.target.value)}><option value="">Seleccione un auditor</option>{(auditors.data?.items??[]).map((a:Auditor)=><option value={a.id} key={a.id}>{a.professionalTitles} {a.fullName} — {a.externalAuditorRegistration}</option>)}</select><div className="clients-modal-actions"><button className="contract-button contract-outline" onClick={()=>setAuditorTarget(null)}>Cancelar</button><button className="contract-button contract-primary" disabled={!selectedAuditor||assign.isPending} onClick={()=>assign.mutate({id:auditorTarget.id,auditorId:selectedAuditor})}>Asignar auditor</button></div></section></div>}</section>
}

