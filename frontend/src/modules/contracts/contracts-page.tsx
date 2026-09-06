import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { contractsApi, type ContractSummary } from './services/contracts.api';
import { clientsApi, type Client } from '../clients/services/clients.api';
import { ClientIcon } from '../clients/components/client-icon';
import { ContractError, GenerateMenu, SearchIcon } from './components/contract-ui';
import '../../styles/contracts.css';
type Row={kind:'contract';contract:ContractSummary}|{kind:'client';client:Client;year:number};
export function ContractsPage(){
 const [params,setParams]=useSearchParams();const [search,setSearch]=useState(params.get('q')??''),[year,setYear]=useState(params.get('year')??'');
 const cache=useQueryClient();const currentYear=new Date().getFullYear();
 const query=useQuery({queryKey:['contracts'],queryFn:contractsApi.listContracts});
 const q=(params.get('q')??'').trim(), y=params.get('year')??'';
 const clientsQuery=useQuery({queryKey:['clients','contract-search',q],queryFn:({signal})=>clientsApi.getClientPage(1,q,signal),enabled:q.length>0});
 const [preparing,setPreparing]=useState<string|null>(null),[prepareError,setPrepareError]=useState<unknown>(null);
 const mutation=useMutation({mutationFn:({clientId,auditedYear}:{clientId:string;auditedYear:number})=>contractsApi.prepareOfficial(clientId,auditedYear),onSuccess:async()=>{setPreparing(null);await cache.invalidateQueries({queryKey:['contracts']})},onError:async e=>{setPreparing(null);setPrepareError(e);await query.refetch()}});
 function prepare(clientId:string,auditedYear:number){setPrepareError(null);setPreparing(clientId);mutation.mutate({clientId,auditedYear})}
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
 const pages=Math.max(1,Math.ceil(rows.length/8)),page=Math.min(pages,Math.max(1,Number(params.get('page'))||1)),visible=rows.slice((page-1)*8,page*8);
 function go(p:number){const next=new URLSearchParams(params);next.set('page',String(p));setParams(next)}
 const loading=query.isPending||(q.length>0&&clientsQuery.isPending);
 return <section className="contracts-page"><header className="contracts-heading"><h1>Contratos</h1><p>Consulta, edita y genera los contratos de auditoría de tus clientes.</p></header>
 <form className="contracts-filters" onSubmit={e=>{e.preventDefault();setParams({q:search.trim(),year})}}><label>Buscar empresa<div className="contract-search"><SearchIcon/><input placeholder="Escriba razón social o RUC..." value={search} onChange={e=>setSearch(e.target.value)}/></div></label><label>Año auditado<select value={year} onChange={e=>setYear(e.target.value)} aria-label="Año auditado"><option value="">Todos</option>{years.map(v=><option key={v} value={v}>{v}</option>)}</select></label><button className="contract-button contract-primary" type="submit"><SearchIcon/>Buscar</button></form>
 <div className="contracts-table-card">{query.isError?<><ContractError error={query.error}/><button className="contract-button contract-outline" onClick={()=>void query.refetch()}>Reintentar</button></>:<>{q.length>0&&clientsQuery.isError&&<ContractError error={clientsQuery.error}/>}{prepareError&&<ContractError error={prepareError}/>}<div className="contracts-table-scroll"><table className="contracts-table"><thead><tr>{['#','Empresa','RUC','Año auditado','Tipo de contrato','Acciones'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{visible.map((row,i)=>{const n=(page-1)*8+i+1;return row.kind==='contract'?<tr key={row.contract.id}><td>{n}</td><td>{row.contract.client?.legalName}</td><td>{row.contract.client?.taxId}</td><td>{row.contract.auditPeriod?.fiscalYear}</td><td>Auditoría Externa</td><td><div className="contract-actions"><Link className="contract-button contract-outline" to={`/contratos/${row.contract.id}`} aria-label={`Ver contrato de ${row.contract.client?.legalName}`}><ClientIcon name="eye"/></Link><Link className="contract-button contract-outline" to={`/contratos/${row.contract.id}/editar`} aria-label={`Editar contrato de ${row.contract.client?.legalName}`}><ClientIcon name="edit"/></Link><GenerateMenu id={row.contract.id}/></div></td></tr>:<tr key={`client-${row.client.id}`}><td>{n}</td><td>{row.client.legalName}</td><td>{row.client.taxId}</td><td>{row.year}</td><td>Sin contrato</td><td><div className="contract-actions"><button className="contract-button contract-primary contract-text-button" disabled={preparing===row.client.id} onClick={()=>prepare(row.client.id,row.year)} aria-label={`Preparar contrato de ${row.client.legalName} ${row.year}`}>{preparing===row.client.id?'Preparando...':'Preparar contrato'}</button></div></td></tr>})}{!visible.length&&<tr><td colSpan={6} className="contracts-empty">{loading?'Cargando contratos...':q?'No se encontraron empresas.':y?'No se encontraron contratos con estos filtros.':'Aún no hay contratos. Prepare el primero seleccionando un cliente existente.'}</td></tr>}</tbody></table></div><div className="contracts-pagination"><p>Mostrando {rows.length?(page-1)*8+1:0} a {Math.min(page*8,rows.length)} de {rows.length} resultados</p><nav aria-label="Paginación de contratos"><button disabled={page<=1} onClick={()=>go(page-1)} aria-label="Página anterior">‹</button><button aria-current="page">{page}</button><button disabled={page>=pages} onClick={()=>go(page+1)} aria-label="Página siguiente">›</button></nav></div></>}</div></section>
}
