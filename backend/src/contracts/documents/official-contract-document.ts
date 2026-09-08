import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHash } from 'crypto';
import { existsSync, readFileSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFile } from 'child_process';
import { promisify } from 'util';
import * as JSZip from 'jszip';

export interface MasterSnapshot { templateVersion: string; templateHash: string; values: Record<string,string>; AUDITOR?: AuditorFooterSnapshot; }
interface Slot { paragraph:number; start:number; end:number; expected:string; key:string; upper:boolean }
interface TemplateMap { version:string; sha256:string; paragraphs:string[]; slots:Slot[] }
const decode=(s:string)=>s.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v:string)=>v[0]==='#'?String.fromCodePoint(v[1]==='x'?parseInt(v.slice(2),16):parseInt(v.slice(1),10)):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v] ?? ''));
const encode=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const texts=(xml:string)=>[...xml.matchAll(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g)];
const textOf=(xml:string)=>texts(xml).map(x=>decode(x[0].replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g,''))).join('');

function resolveContractTemplatesDir(): string {
 const candidates=[
  join(process.cwd(),'storage','templates','contracts'),
  join(process.cwd(),'backend','storage','templates','contracts'),
 ];
 const folder=candidates.find(candidate=>
  existsSync(join(candidate,'template-map.json'))&&existsSync(join(candidate,'contrato-auditoria-externa-base.docx')),
 );
 if(!folder)throw new Error('Contract templates not found');
 return folder;
}

/** Minimal character edits: unchanged characters stay in their original runs. */
export function textEdits(old:string,next:string) {
 let a=0,b=old.length,c=next.length;
 while(a<b&&a<c&&old[a]===next[a])a++;
 while(b>a&&c>a&&old[b-1]===next[c-1]){b--;c--;}
 const x=old.slice(a,b),y=next.slice(a,c),w=y.length+1;
 const dp=new Uint16Array((x.length+1)*w);
 for(let i=x.length-1;i>=0;i--)for(let j=y.length-1;j>=0;j--)dp[i*w+j]=x[i]===y[j]?dp[(i+1)*w+j+1]+1:Math.max(dp[(i+1)*w+j],dp[i*w+j+1]);
 const edits:{start:number;end:number;value:string}[]=[];let i=0,j=0,current:typeof edits[number]|undefined;
 while(i<x.length||j<y.length){
  if(i<x.length&&j<y.length&&x[i]===y[j]){if(current){edits.push(current);current=undefined;}i++;j++;}
  else {current??={start:a+i,end:a+i,value:''};if(j<y.length&&(i===x.length||dp[i*w+j+1]>=dp[(i+1)*w+j]))current.value+=y[j++];else{ i++;current.end=a+i;}}
 }
 if(current)edits.push(current);return edits;
}
export function patchParagraph(xml:string,next:string,ranges?:{start:number;end:number;value:string}[]):string {
 const original=textOf(xml); if(original===next)return xml;
 const nodes=texts(xml); const values=nodes.map(n=>decode(n[0].replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g,'')));
 const lengths=values.map(v=>v.length);const offsets:number[]=[];let offset=0;for(const value of values){offsets.push(offset);offset+=value.length;}
 for(const edit of (ranges??textEdits(original,next)).slice().sort((a,b)=>b.start-a.start)){
  let first=offsets.findIndex((start,k)=>edit.start>=start&&edit.start<start+lengths[k]);
  if(first<0)first=values.length-1;
  if(first<0)throw new BadRequestException('Sección sin texto editable');
  for(let k=values.length-1;k>=first;k--){const start=offsets[k],end=start+(k+1<offsets.length?offsets[k+1]-start:original.length-start);if(start>edit.end)continue;
   const lo=Math.max(0,edit.start-start),hi=Math.min(end-start,edit.end-start);
   if(hi>lo)values[k]=values[k].slice(0,lo)+values[k].slice(hi);
  }
  const local=edit.start-offsets[first];values[first]=values[first].slice(0,local)+edit.value+values[first].slice(local);
 }
 for(let k=nodes.length-1;k>=0;k--){const node=nodes[k];const originalValue=decode(node[0].replace(/^<w:t(?:\s[^>]*)?>|<\/w:t>$/g,''));if(values[k]===originalValue)continue;
  let opening=node[0].slice(0,node[0].indexOf('>')+1);if(!opening.includes('xml:space='))opening=opening.slice(0,-1)+' xml:space="preserve">';
  xml=xml.slice(0,node.index!)+opening+encode(values[k])+'</w:t>'+xml.slice(node.index!+node[0].length);
 }return xml;
}
type AuditorFooterSnapshot={professionalTitles:string;fullName:string;position:string;ruc:string;externalAuditorRegistration:string;judicialExpertNumber:string;accountantLicenseNumber:string;address:string;phone:string;email:string};
const footerTextKey=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'').toLocaleLowerCase('es');

/**
 * A professional footer is duplicated by Word in DrawingML and VML text boxes.
 * Each text box has ordinary, non-nested paragraphs, so patching at this level
 * keeps its shape, position and run formatting intact.  Parsing all `w:p`
 * nodes from the full footer would stop at the first nested paragraph and leave
 * the VML fallback with stale text.
 */
function patchAuditorTextBox(xml:string,auditor:AuditorFooterSnapshot):string {
 const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
 const patches:{index:number;length:number;value:string}[]=[];
 let clearAddressContinuation=false;
 for(const paragraph of paragraphs){
  const compact=footerTextKey(textOf(paragraph[0]));let next:string|undefined;
  if(clearAddressContinuation){
   // The master address is wrapped over two paragraphs.  The first receives
   // the selected auditor address; clear the old continuation without moving
   // or removing its text box structure.
   next='';clearAddressContinuation=false;
  } else if(compact.includes('email:'))next=`Email: ${auditor.email}`;
  else if(compact.includes('telefono:'))next=`Teléfono: ${auditor.phone}`;
  else if(compact.includes('direccion:')){next=`Dirección: ${auditor.address}`;clearAddressContinuation=true;}
  else if(compact.includes('rucno.'))next=`RUC No. ${auditor.ruc}`;
  else if(compact.includes('registronacional')&&compact.includes('auditorexterno'))next=`Registro Nacional Auditor Externo No. ${auditor.externalAuditorRegistration}`;
  else if(compact.includes('peritofuncionjudicial'))next=`Perito Función Judicial No. ${auditor.judicialExpertNumber}`;
  else if(compact.includes('contadormatricula'))next=`Contador Matricula No. ${auditor.accountantLicenseNumber}`;
  else if(compact.includes('gerenteconsultor')&&compact.includes('auditor'))next=auditor.position;
  else if(compact.includes('wilmerespinoza'))next=`${auditor.professionalTitles} ${auditor.fullName}`;
  if(next!==undefined)patches.push({index:paragraph.index!,length:paragraph[0].length,value:patchParagraph(paragraph[0],next)});
 }
 for(const patch of patches.reverse())xml=xml.slice(0,patch.index)+patch.value+xml.slice(patch.index+patch.length);
 return xml;
}

function patchAuditorFooterPart(xml:string,auditor:AuditorFooterSnapshot):string {
 return xml.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g,textBox=>patchAuditorTextBox(textBox,auditor));
}
/**
 * Bloque de firmas en tabla de 2 columnas sin bordes.
 * Reemplaza los párrafos p62-p64 (nombres/posición/empresa separados con
 * espacios manuales, que se montan con nombres largos) por una tabla con
 * columnas propias: cada firmante queda centrado en su columna y el texto
 * largo se ajusta dentro de la celda sin invadir la otra columna.
 * Solo toca word/document.xml; la plantilla, el mapa, el hash y el pie de
 * página (parte word/footer*.xml) quedan intactos. Si la forma esperada no
 * se reconoce, devuelve el XML sin cambios para no romper la generación.
 */
export function signaturesTable(xml:string, signatureFont:string, signatureTexts:[string,string,string]):string {
 const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
 // Se buscan los tres párrafos maestros por contenido, no por índice: los
 // párrafos agregados pueden aparecer antes de las firmas.
 const [nameText,roleText,companyText]=signatureTexts;
 const names=paragraphs.find(item=>textOf(item[0])===nameText)?.[0];
 const roles=paragraphs.find(item=>textOf(item[0])===roleText)?.[0];
 const company=paragraphs.find(item=>textOf(item[0])===companyText)?.[0];
 if(!names||!roles||!company)return xml;
 const parts=(text:string)=>text.split(/\s{2,}|\t+/).map(t=>t.trim()).filter(Boolean);
 const nameParts=parts(textOf(names)),roleParts=parts(textOf(roles)),companyParts=parts(textOf(company));
 if(nameParts.length!==2||roleParts.length!==2||companyParts.length<1)return xml;
 const styleOf=(paragraph:string)=>{
  const runs=[...paragraph.matchAll(/<w:rPr>[\s\S]*?<\/w:rPr>/g)].map(m=>m[0]);
  return runs.find(r=>r.includes('<w:b'))??runs[0]??'';
 };
 const fontFor=(rpr:string)=>{
  const withoutFont=rpr.replace(/<w:rFonts\b[^>]*\/>/g,'');
  if(!withoutFont)return `<w:rPr>${signatureFont}</w:rPr>`;
  return withoutFont.replace('<w:rPr>',`<w:rPr>${signatureFont}`);
 };
 // The table must not inherit a font from its table style.  Every generated
 // signature run receives the document-default rFonts copied from the master.
 const [nameStyle,roleStyle,companyStyle]=[styleOf(names),styleOf(roles),styleOf(company)].map(fontFor);
 const cell=(text:string,rpr:string)=>text
  ? `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="0" w:line="276" w:lineRule="auto"/>${rpr}</w:pPr><w:r>${rpr}<w:t xml:space="preserve">${encode(text)}</w:t></w:r></w:p>`
  : `<w:p/>`;
 const row=(left:string,leftStyle:string,right:string,rightStyle:string)=>`<w:tr><w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${cell(left,leftStyle)}</w:tc><w:tc><w:tcPr><w:tcW w:w="4500" w:type="dxa"/></w:tcPr>${cell(right,rightStyle)}</w:tc></w:tr>`;
 const border=`<w:top w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:left w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:bottom w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:right w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:insideH w:val="nil" w:sz="0" w:space="0" w:color="auto"/><w:insideV w:val="nil" w:sz="0" w:space="0" w:color="auto"/>`;
 const table=`<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/><w:tblLayout w:type="fixed"/><w:tblBorders>${border}</w:tblBorders></w:tblPr><w:tblGrid><w:gridCol w:w="4500"/><w:gridCol w:w="4500"/></w:tblGrid>${row(nameParts[0],nameStyle,nameParts[1],nameStyle)}${row(roleParts[0],roleStyle,roleParts[1],roleStyle)}${row(companyParts.join(' '),companyStyle,'',companyStyle)}</w:tbl>`;
 const start=xml.indexOf(names),end=xml.indexOf(company)+company.length;
 if(start<0||end<start)return xml;
 return xml.slice(0,start)+table+xml.slice(end);
}
@Injectable()
export class OfficialContractDocument {
 private readonly logger = new Logger(OfficialContractDocument.name);
 readonly folder=resolveContractTemplatesDir();
 readonly map:TemplateMap=JSON.parse(readFileSync(join(this.folder,'template-map.json'),'utf8'));
 private readonly masterDocx=readFileSync(join(this.folder,'contrato-auditoria-externa-base.docx'));
 private readonly masterHash=createHash('sha256').update(this.masterDocx).digest('hex');
 private pdfQueue:Promise<unknown>=Promise.resolve();
 snapshot(values:Record<string,string>):MasterSnapshot{return {templateVersion:this.map.version,templateHash:this.map.sha256,values};}
 isOfficial(value:unknown):value is MasterSnapshot{return !!value&&typeof value==='object'&&(value as MasterSnapshot).templateVersion===this.map.version;}
 sections(snapshot:MasterSnapshot){
  return this.map.paragraphs.map((body,index)=>{
   for(const slot of this.map.slots.filter(s=>s.paragraph===index).sort((a,b)=>b.start-a.start)){
    if(body.slice(slot.start,slot.end)!==slot.expected)throw new Error('La plantilla no coincide con el mapa');
    const value=snapshot.values[slot.key]??'';body=body.slice(0,slot.start)+(slot.upper?value.toLocaleUpperCase('es'):value)+body.slice(slot.end);
   }
   return {clauseKey:`p${index}`,title:index<2?'Título del contrato':`Sección ${index}`,body,sortOrder:index};
  }).filter(s=>s.body.trim());
 }
 async docx(snapshot:MasterSnapshot,sections:{clauseKey:string;body:string;title?:string;sortOrder?:number;isCustom?:boolean}[]){
  const source=this.masterDocx;
  if(this.masterHash!==snapshot.templateHash||snapshot.templateHash!==this.map.sha256)throw new BadRequestException('La plantilla maestra cambió; no se generó el documento.');
  const zip=await JSZip.loadAsync(source);let xml=await zip.file('word/document.xml')!.async('string');
  const styles=await zip.file('word/styles.xml')!.async('string');
  const signatureFont=styles.match(/<w:docDefaults>[\s\S]*?<w:rPrDefault>[\s\S]*?<w:rPr>[\s\S]*?(<w:rFonts\b[^>]*\/>)/)?.[1];
  if(!signatureFont)throw new Error('No se pudo obtener la fuente de la plantilla para las firmas.');
  const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)];
  if(paragraphs.length!==this.map.paragraphs.length)throw new Error('Estructura DOCX inesperada');
  const base=sections.filter(section=>!section.isCustom&&/^p\d+$/.test(section.clauseKey));
  const byKey=new Map(base.map(s=>[s.clauseKey,s.body]));
  const additions=new Map<string,typeof sections>();let previous='';
  for(const section of sections.slice().sort((a,b)=>(a.sortOrder??0)-(b.sortOrder??0))){if(!section.isCustom&&/^p\d+$/.test(section.clauseKey))previous=section.clauseKey;else if(section.isCustom&&previous){const items=additions.get(previous)??[];items.push(section);additions.set(previous,items);}}
  for(let i=paragraphs.length-1;i>=0;i--){const p=paragraphs[i];if(textOf(p[0])!==this.map.paragraphs[i])throw new Error('Texto DOCX inesperado');const body=byKey.get(`p${i}`);if(body===undefined)continue;const ranges=this.map.slots.filter(s=>s.paragraph===i).map(slot=>{const raw=snapshot.values[slot.key]??'';return {start:slot.start,end:slot.end,value:slot.upper?raw.toLocaleUpperCase('es'):raw};}).filter(slot=>this.map.paragraphs[i].slice(slot.start,slot.end)!==slot.value);
    // Semantic substitutions inherit the first run of their verified slot. Manual
    // changes then preserve unchanged text and its existing run formatting.
    const prepared=ranges.length?patchParagraph(p[0],'',ranges):p[0];
  const edited=patchParagraph(prepared,body);const custom=(additions.get(`p${i}`)??[]).map(item=>{
    const bodyParagraph=patchParagraph(p[0],item.body);
    return item.title?.trim()?`${patchParagraph(p[0],item.title)}${bodyParagraph}`:bodyParagraph;
  }).join('');xml=xml.slice(0,p.index!)+edited+custom+xml.slice(p.index!+p[0].length);}
  xml=signaturesTable(xml,signatureFont,[this.map.paragraphs[62],this.map.paragraphs[63],this.map.paragraphs[64]]);
  const legacyAuditor=(snapshot.values as unknown as {AUDITOR?:AuditorFooterSnapshot}).AUDITOR;
  const auditor=snapshot.AUDITOR??legacyAuditor;
  if(auditor)for(const name of Object.keys(zip.files).filter(name=>/^word\/(footer|header)\d+\.xml$/.test(name))){const part=zip.file(name);if(part)zip.file(name,patchAuditorFooterPart(await part.async('string'),auditor),{date:zip.files[name].date});}
  zip.file('word/document.xml',xml,{date:zip.files['word/document.xml'].date});return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
  }
 async pdf(docx:Buffer):Promise<Buffer>{
  const run=async()=>{const dir=mkdtempSync(join(tmpdir(),'audit-contract-'));try{
   const input=join(dir,'contract.docx'),output=join(dir,'contract.pdf');writeFileSync(input,docx);
   if(process.platform!=='win32')throw new Error('Microsoft Word en Windows es necesario para conservar la fidelidad de esta plantilla.');
   await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',join(this.folder,'../../../scripts/contract-to-pdf.ps1'),'-InputPath',input,'-OutputPath',output],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});
    return readFileSync(output);
   }catch(error){this.logger.error(`DOCX->PDF con Microsoft Word falló para ${dir}: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);throw new ServiceUnavailableException('No se pudo convertir con Microsoft Word. Verifique que Word esté instalado y disponible en la sesión del servidor; el Word guardado no se ha alterado.');}finally{rmSync(dir,{recursive:true,force:true});}};
  const result=this.pdfQueue.then(run,run);this.pdfQueue=result.catch(()=>undefined);return result;
 }
}


