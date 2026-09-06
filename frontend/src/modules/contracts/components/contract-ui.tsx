import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClientIcon } from '../../clients/components/client-icon';
import { DashboardIcon } from '../../../components/dashboard/dashboard-icon';
import { contractsApi } from '../services/contracts.api';
import { getApiErrorMessage } from '../../clients/services/clients.api';
export function BackToContracts(){return <Link className="contract-button contract-outline" to="/contratos"><ClientIcon name="back"/>Volver a contratos</Link>}
export function ContractError({error}:{error:unknown}){return <p className="contract-error" role="alert">{getApiErrorMessage(error,'No se pudo completar la operación.')}</p>}
export function DownloadIcon(){return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M3 15v6h18v-6"/></svg>}
export function SearchIcon(){return <DashboardIcon name="search"/>}
export function GenerateMenu({id,label=false}:{id:string;label?:boolean}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>();const ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{const close=(e:PointerEvent)=>{if(!ref.current?.contains(e.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
 async function generate(format:'docx'|'pdf'){setOpen(false);setBusy(true);setError(undefined);try{const doc=await contractsApi.generateDocument(id,format);await contractsApi.downloadDocument(id,doc)}catch(e){setError(e)}finally{setBusy(false)}}
 return <div className="contract-download" ref={ref} onKeyDown={e=>{if(e.key==='Escape')setOpen(false)}}><button className="contract-button contract-primary" aria-label="Generar o descargar contrato" aria-expanded={open} aria-haspopup="menu" disabled={busy} onClick={()=>setOpen(!open)}><DownloadIcon/>{label&&(busy?'Generando...':'Generar / Descargar')}</button>{open&&<div className="contract-menu" role="menu"><button role="menuitem" onClick={()=>void generate('docx')}><span aria-hidden="true" className="contract-word">W</span>Generar Word</button><button role="menuitem" onClick={()=>void generate('pdf')}><span aria-hidden="true" className="contract-pdf">PDF</span>Generar PDF</button></div>}{busy&&<span role="status" className="contract-generation-status">Generando...</span>}{!!error&&<ContractError error={error}/>}</div>
}
