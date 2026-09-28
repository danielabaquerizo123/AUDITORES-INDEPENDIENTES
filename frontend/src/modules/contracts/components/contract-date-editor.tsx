import {useCallback,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
/* eslint-disable react-refresh/only-export-components */

const MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const SHORT_MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTH_NAMES=MONTHS.join('|');
const FULL_DATE_PATTERN=new RegExp(`(\\d{1,2}) de (${MONTH_NAMES}) (de|del) (\\d{4})`,'gi');
const MONTH_YEAR_PATTERN=new RegExp(`(${MONTH_NAMES})(?: (de|del))? (\\d{4})`,'gi');

type ContractDateOccurrence={id:string;text:string;start:number;end:number;day?:number;month:number;year:number;connector:'de'|'del'|'';monthStyle:'lower'|'title'|'upper';precision:'DAY_MONTH_YEAR'|'MONTH_YEAR'};

function contractDateOccurrences(body:string,sectionId:string):ContractDateOccurrence[]{
 const full=[...body.matchAll(FULL_DATE_PATTERN)].map((match,index)=>({id:`${sectionId}-${match.index}-${index}`,text:match[0],start:match.index!,end:match.index!+match[0].length,day:Number(match[1]),month:MONTHS.indexOf(match[2].toLowerCase()),year:Number(match[4]),connector:match[3].toLowerCase() as 'de'|'del',monthStyle:'lower' as const,precision:'DAY_MONTH_YEAR' as const}));
 const partial=[...body.matchAll(MONTH_YEAR_PATTERN)].filter(match=>!full.some(date=>match.index!<date.end&&match.index!+match[0].length>date.start)).map((match,index)=>({id:`${sectionId}-${match.index}-partial-${index}`,text:match[0],start:match.index!,end:match.index!+match[0].length,month:MONTHS.indexOf(match[1].toLowerCase()),year:Number(match[3]),connector:(match[2]?.toLowerCase()??'') as 'de'|'del'|'',monthStyle:match[1]===match[1].toUpperCase()?'upper' as const:match[1]===match[1][0].toUpperCase()+match[1].slice(1).toLowerCase()?'title' as const:'lower' as const,precision:'MONTH_YEAR' as const}));
 return [...full,...partial].sort((a,b)=>a.start-b.start);
}

export const hasContractDates=(body:string,sectionId:string)=>contractDateOccurrences(body,sectionId).length>0;

type TokenProps={occurrence:ContractDateOccurrence;open:boolean;onOpen:()=>void;onClose:()=>void;onApply:(next:string)=>void};

function ContractDateToken({occurrence,open,onOpen,onClose,onApply}:TokenProps){
 const root=useRef<HTMLSpanElement>(null),[day,setDay]=useState(occurrence.day??1),[month,setMonth]=useState(occurrence.month),[year,setYear]=useState(occurrence.year);
 useEffect(()=>{if(open){setDay(occurrence.day??1);setMonth(occurrence.month);setYear(occurrence.year)}},[open,occurrence.day,occurrence.month,occurrence.year]);
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))onClose()};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[open,onClose]);
 const moveMonth=(offset:number)=>{const next=new Date(year,month+offset,1);setMonth(next.getMonth());setYear(next.getFullYear());setDay(current=>Math.min(current,new Date(next.getFullYear(),next.getMonth()+1,0).getDate()))};
 const apply=()=>{const monthName=MONTHS[month],formattedMonth=occurrence.monthStyle==='upper'?monthName.toUpperCase():occurrence.monthStyle==='title'?monthName[0].toUpperCase()+monthName.slice(1):monthName;onApply(occurrence.precision==='DAY_MONTH_YEAR'?`${day} de ${monthName} ${occurrence.connector} ${year}`:`${formattedMonth}${occurrence.connector?` ${occurrence.connector}`:''} ${year}`);onClose()};
 const firstWeekday=(new Date(year,month,1).getDay()+6)%7,days=new Date(year,month+1,0).getDate();
 return <span className="contract-date-token-wrap" ref={root} contentEditable={false}><button type="button" className="contract-date-token" aria-label={`Editar fecha ${occurrence.text}`} aria-expanded={open} onClick={onOpen}><span>{occurrence.text}</span><span aria-hidden="true">📅</span></button>{open&&<span className="contract-date-popover" role="dialog" aria-label={occurrence.precision==='DAY_MONTH_YEAR'?'Cambiar fecha':'Cambiar mes y año'}><strong>{occurrence.precision==='DAY_MONTH_YEAR'?'Cambiar fecha':'Cambiar mes y año'}</strong>{occurrence.precision==='DAY_MONTH_YEAR'?<><span className="contract-date-nav"><button type="button" aria-label="Mes anterior" onClick={()=>moveMonth(-1)}>‹</button><select aria-label="Mes del calendario" value={month} onChange={event=>setMonth(Number(event.target.value))}>{MONTHS.map((name,index)=><option value={index} key={name}>{name[0].toUpperCase()+name.slice(1)}</option>)}</select><select aria-label="Año del calendario" value={year} onChange={event=>setYear(Number(event.target.value))}>{Array.from({length:21},(_,offset)=>occurrence.year-10+offset).map(value=><option key={value}>{value}</option>)}</select><button type="button" aria-label="Mes siguiente" onClick={()=>moveMonth(1)}>›</button></span><span className="contract-calendar-weekdays">{['L','M','X','J','V','S','D'].map(name=><span key={name}>{name}</span>)}</span><span className="contract-calendar-grid">{Array.from({length:firstWeekday},(_,index)=><span key={`blank-${index}`}/>)}{Array.from({length:days},(_,index)=>index+1).map(value=><button type="button" aria-label={`Día ${value}`} aria-pressed={value===day} className={value===day?'active':''} onClick={()=>setDay(value)} key={value}>{value}</button>)}</span></>:<><span className="contract-date-nav"><button type="button" aria-label="Año anterior" onClick={()=>setYear(value=>value-1)}>‹</button><b>{year}</b><button type="button" aria-label="Año siguiente" onClick={()=>setYear(value=>value+1)}>›</button></span><span className="contract-month-grid">{SHORT_MONTHS.map((name,index)=><button type="button" aria-label={MONTHS[index]} aria-pressed={index===month} className={index===month?'active':''} onClick={()=>setMonth(index)} key={name}>{name}</button>)}</span><small>Esta fecha no requiere seleccionar un día.</small></>}<span className="contract-date-popover-actions"><button type="button" className="contract-button contract-outline" onClick={onClose}>Cancelar</button><button type="button" className="contract-button contract-primary" onClick={apply}>Aplicar</button></span></span>}</span>;
}

type EditorProps={sectionId:string;body:string;openDateId:string|null;onOpenDate:(id:string)=>void;onCloseDate:()=>void;onChange:(body:string)=>void};

export function ContractYearToken({year,onApply}:{year:number;onApply:(year:number)=>void}){
 const root=useRef<HTMLSpanElement>(null),[open,setOpen]=useState(false),[selectedYear,setSelectedYear]=useState(year);
 const close=useCallback(()=>setOpen(false),[]);
 useEffect(()=>{if(open)setSelectedYear(year)},[open,year]);
 useEffect(()=>{if(!open)return;const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))close()};const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')close()};document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)}},[open,close]);
 return <span className="contract-date-token-wrap" ref={root} contentEditable={false}><button type="button" className="contract-date-token" aria-label={`Editar año ${year}`} aria-expanded={open} onClick={()=>setOpen(true)}><span>{year}</span><span aria-hidden="true">📅</span></button>{open&&<span className="contract-date-popover" role="dialog" aria-label="Cambiar año del encabezado"><strong>Cambiar año</strong><span className="contract-date-nav"><button type="button" aria-label="Año anterior del encabezado" onClick={()=>setSelectedYear(value=>value-1)}>‹</button><b>{selectedYear}</b><button type="button" aria-label="Año siguiente del encabezado" onClick={()=>setSelectedYear(value=>value+1)}>›</button></span><small>Seleccione el año que aparecerá en el encabezado.</small><span className="contract-date-popover-actions"><button type="button" className="contract-button contract-outline" onClick={close}>Cancelar</button><button type="button" className="contract-button contract-primary" onClick={()=>{onApply(selectedYear);close()}}>Aplicar</button></span></span>}</span>;
}

export function ContractDateInlineEditor({sectionId,body,openDateId,onOpenDate,onCloseDate,onChange}:EditorProps){
 const dates=contractDateOccurrences(body,sectionId),parts:ReactNode[]=[];let cursor=0;
 if(!dates.length)return <textarea aria-label="Contenido editable" maxLength={50000} rows={Math.max(3,Math.ceil(body.length/105))} value={body} onChange={event=>onChange(event.target.value)}/>;
 const changeText=(start:number,end:number,text:string)=>onChange(body.slice(0,start)+text+body.slice(end));
 dates.forEach(date=>{if(date.start>cursor){const start=cursor,end=date.start;parts.push(<span className="contract-editable-text" contentEditable suppressContentEditableWarning onBlur={event=>changeText(start,end,event.currentTarget.textContent??'')} key={`text-${start}`}>{body.slice(start,end)}</span>)}parts.push(<ContractDateToken occurrence={date} open={openDateId===date.id} onOpen={()=>onOpenDate(date.id)} onClose={onCloseDate} onApply={next=>onChange(body.slice(0,date.start)+next+body.slice(date.end))} key={date.id}/>);cursor=date.end});
 if(cursor<body.length){const start=cursor;parts.push(<span className="contract-editable-text" contentEditable suppressContentEditableWarning onBlur={event=>changeText(start,body.length,event.currentTarget.textContent??'')} key={`text-${start}`}>{body.slice(start)}</span>)}
 return <div className="contract-inline-document" aria-label="Contenido editable">{parts}</div>;
}
