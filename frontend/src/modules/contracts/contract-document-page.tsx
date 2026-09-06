import { useEffect,useState } from 'react';
import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query';
import { Link,useNavigate,useParams } from 'react-router-dom';
import { contractsApi,type ContractSummary } from './services/contracts.api';
import { BackToContracts,ContractError,GenerateMenu } from './components/contract-ui';
import { ClientIcon } from '../clients/components/client-icon';
import { httpClient } from '../../services/http-client';
import '../../styles/contracts.css';
/** Secciones variables de la plantilla oficial (fechas, plazos y honorarios).
 * Todo lo demás (texto jurídico fijo, datos de Clientes, firmas) es solo lectura. */
const EDITABLE_SECTIONS:Record<string,string>={
 p20:'Fecha límite de entrega de información',p22:'Fecha de estados financieros definitivos',
 p23:'Plazo de reunión de Junta General',p44:'Fecha del borrador del informe',
 p45:'Plazo de comentarios (días hábiles)',p46:'Fechas de entrega de informes e ICT',
 p47:'Honorarios y forma de pago',p58:'Fecha de terminación del contrato',p60:'Fecha y lugar de firma',
};
function SavedSectionsEditor({contract}:{contract:ContractSummary}){
 const base=contract.clauses?.map(c=>({clauseKey:c.clauseKey,body:c.body}))??[];
 const [drafts,setDrafts]=useState<Record<string,string>>(()=>Object.fromEntries(base.map(s=>[s.clauseKey,s.body])));
 const [editing,setEditing]=useState<string|null>(null);const cache=useQueryClient(),navigate=useNavigate();
 const clean=(v:string)=>v.replace(/[\r\n\t]/g,' ');
 const mutation=useMutation({mutationFn:()=>contractsApi.updateContract(contract.id,{sections:base.map(s=>({clauseKey:s.clauseKey,body:clean(drafts[s.clauseKey]??s.body)})),expectedUpdatedAt:contract.updatedAt}),onSuccess:async()=>{setEditing(null);await cache.invalidateQueries({queryKey:['contracts']});navigate(`/contratos/${contract.id}`)}});
 return <form onSubmit={e=>{e.preventDefault();mutation.mutate()}}><fieldset disabled={mutation.isPending}><p className="contract-review-note">Solo las secciones variables (fechas, plazos y honorarios) pueden editarse. El texto jurídico fijo, los datos del cliente y las firmas son de solo lectura.</p>{base.map(s=>{const label=EDITABLE_SECTIONS[s.clauseKey];const text=drafts[s.clauseKey]??s.body;if(!label)return <p key={s.clauseKey}>{text}</p>;const active=editing===s.clauseKey;return <details className="contract-edit-section" key={s.clauseKey} open><summary>{label}</summary><p>{base.find(b=>b.clauseKey===s.clauseKey)?.body}</p>{active?<><label>Contenido editable<textarea maxLength={8000} rows={Math.min(12,Math.max(3,Math.ceil(text.length/105)))} value={text} onChange={e=>setDrafts(d=>({...d,[s.clauseKey]:e.target.value}))}/></label><div className="contract-form-actions"><button type="button" className="contract-button contract-outline" onClick={()=>{setDrafts(d=>({...d,[s.clauseKey]:s.body}));setEditing(null)}}>Cancelar</button><button type="submit" className="contract-button contract-primary" onClick={()=>setEditing(null)} disabled={mutation.isPending}>{mutation.isPending?'Guardando...':'Guardar'}</button></div></>:<button type="button" className="contract-button contract-outline" onClick={()=>setEditing(s.clauseKey)} aria-label={`Editar ${label}`}><ClientIcon name="edit"/>Editar</button>}</details>})}{mutation.isError&&<ContractError error={mutation.error}/>}<div className="contract-form-actions"><Link className="contract-button contract-outline" to={`/contratos/${contract.id}`}>Cancelar</Link></div></fieldset></form>
}
export function ContractDocumentPage({edit=false}:{edit?:boolean}){
 const {id=''}=useParams();useEffect(()=>{window.scrollTo(0,0)},[id,edit]);const query=useQuery({queryKey:['contracts',id],queryFn:()=>contractsApi.getContract(id)});
 const [pdf,setPdf]=useState('');useEffect(()=>()=>{if(pdf)URL.revokeObjectURL(pdf)},[pdf]);
 const preview=useMutation({mutationFn:async()=>{const doc=await contractsApi.generateDocument(id,'pdf');const result=await httpClient.get<Blob>(`/contracts/${id}/documents/${doc.id}/download`,{responseType:'blob'});return URL.createObjectURL(result.data)},onSuccess:setPdf});
 const c=query.data,official=!!c?.variables?.templateVersion;
 return <section className="contracts-page"><BackToContracts/>{query.isPending?<p className="contracts-empty">Cargando contrato...</p>:query.isError?<><ContractError error={query.error}/><button className="contract-button contract-outline" onClick={()=>void query.refetch()}>Reintentar</button></>:c&&<><header className="contracts-heading contract-detail-heading"><div><h1>{edit?'Editar contrato':c.client?.legalName}</h1><p>{edit?`${c.client?.legalName} · `:''}RUC: {c.client?.taxId} · Año auditado: {c.auditPeriod?.fiscalYear} · Auditoría Externa</p></div>{!edit&&<div className="contract-detail-actions"><Link className="contract-button contract-outline" to={`/contratos/${id}/editar`}>Editar contrato</Link><GenerateMenu id={id} label/></div>}</header>{edit?(official?<SavedSectionsEditor key={c.id} contract={c}/>:<p className="contract-review-note">Este contrato anterior no usa la plantilla oficial. <Link to={`/contracts/${id}/preview`}>Abrir su pantalla existente</Link>.</p>):<><div className="contract-document-toolbar"><h2>Contenido guardado</h2><button className="contract-button contract-outline" disabled={preview.isPending} onClick={()=>preview.mutate()}>{preview.isPending?'Abriendo documento...':'Ver documento PDF'}</button></div>{preview.isError&&<ContractError error={preview.error}/>} {pdf?<iframe className="contract-pdf-preview" title="Documento contractual PDF" src={pdf}/>:<article className="contract-reading">{c.clauses?.map(s=><p key={s.clauseKey}>{s.body}</p>)}</article>}</>}</>}</section>
}
