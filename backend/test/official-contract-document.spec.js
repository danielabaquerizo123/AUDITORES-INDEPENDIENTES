jest.setTimeout(30000);
const fs=require('fs');
const JSZip=require('jszip');
const {OfficialContractDocument,patchParagraph}=require('../dist/src/contracts/documents/official-contract-document');
const {OFFICIAL_UAFE_BODY,OFFICIAL_UAFE_CLAUSE_KEY,prepareNewOfficialContractSections}=require('../dist/src/contracts/official-contract-content');
describe('Plantilla oficial DOCX',()=>{
 const engine=new OfficialContractDocument();
 test('reemplaza a través de runs sin alterar sus propiedades',()=>{
  const xml='<w:p><w:pPr/><w:r><w:rPr><w:b/></w:rPr><w:t>10 dí</w:t></w:r><w:r><w:t>as hábiles</w:t></w:r></w:p>';
  expect(patchParagraph(xml,'20 días hábiles').replace(' xml:space="preserve"','')).toBe(xml.replace('10 dí','20 dí'));
  expect(patchParagraph(xml,'Comentario nuevo').replace(/<[^>]+>/g,'')).toBe('Comentario nuevo');
 });

 test('una variable ampliada conserva la negrita de su posición completa',()=>{
  const xml='<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>DRIVERNET S.A.</w:t></w:r><w:r><w:t> con RUC</w:t></w:r></w:p>';
  const result=patchParagraph(xml,'',[{start:0,end:14,value:'COMPAÑÍA NUEVA S.A.'}]);
  expect(result).toContain('<w:b/></w:rPr><w:t xml:space="preserve">COMPAÑÍA NUEVA S.A.</w:t>');
  expect(result).toContain('<w:t> con RUC</w:t>');
 });
 test('solo autocompleta posiciones identificadas del ejercicio auditado',()=>{
  const values={};for(const s of engine.map.slots)values[s.key]=s.expected;values.AUDITED_YEAR='2031';const sections=engine.sections(engine.snapshot(values));
  expect(sections.find(s=>s.clauseKey==='p1').body).toContain('2031');
  expect(sections.find(s=>s.clauseKey==='p60').body).toContain('2025');
  expect(sections.find(s=>s.clauseKey==='p46').body).toContain('2026');
 });
 test('conserva todos los miembros y propiedades OOXML salvo texto editado y bloque de firmas',async()=>{
  const values={};for(const s of engine.map.slots)values[s.key]=s.expected;values.COMPANY_NAME='TEST TIA S.A.';const snapshot=engine.snapshot(values),sections=engine.sections(snapshot);sections.find(s=>s.clauseKey==='p45').body=sections.find(s=>s.clauseKey==='p45').body.replace('10 días hábiles','20 días hábiles');
  const original=await JSZip.loadAsync(fs.readFileSync(engine.folder+'/contrato-auditoria-externa-base.docx'));const result=await JSZip.loadAsync(await engine.docx(snapshot,sections));
  for(const key of Object.keys(original.files).filter(k=>!original.files[k].dir&&k!=='word/document.xml'))expect((await result.file(key).async('nodebuffer')).equals(await original.file(key).async('nodebuffer'))).toBe(true);
  const xml=await result.file('word/document.xml').async('string'),source=await original.file('word/document.xml').async('string');
  const structural=s=>s.replace(/<w:t(?:\s[^>]*)?>[\s\S]*?<\/w:t>/g,'<w:t/>');
  const tables=[...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)];
  expect(tables).toHaveLength(1);
  const table=tables[0][0];
  expect(table).toContain('<w:gridCol w:w="4500"/><w:gridCol w:w="4500"/>');
  expect(table).toMatch(/<w:tblBorders><w:top w:val="nil"/);
  expect([...table.matchAll(/<w:tr>/g)]).toHaveLength(3);
  expect([...table.matchAll(/<w:tc>/g)]).toHaveLength(6);
  expect(table.replace(/<[^>]+>/g,'')).toContain('TEST TIA S.A.');
  expect(table.replace(/<[^>]+>/g,'')).toContain('CPA. WILMER ESPINOZA TOALOMBO');
  expect(table).not.toMatch(/ {2,}/);
  const parasOf=s=>[...s.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>/g)].map(m=>[...m[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(n=>n[1]).join(''));
  const srcParas=parasOf(source),outParas=parasOf(xml);
  expect(outParas.length).toBe(srcParas.length+2);
  const byKey=Object.fromEntries(sections.map(s=>[s.clauseKey,s.body]));
  const exp161=[];for(let i=1;i<=61;i++)exp161.push(i===61?'':byKey[`p${i}`]);
  expect(outParas.slice(0,61)).toEqual(exp161);
  const split=t=>t.split(/\s{2,}|\t+/).map(x=>x.trim()).filter(Boolean);
  const [nL,nR]=split(byKey.p62),[rL,rR]=split(byKey.p63),[cL]=split(byKey.p64);
  expect(outParas.slice(61)).toEqual([nL,nR,rL,rR,cL,'']);
  expect(xml.replace(/<[^>]+>/g,'')).toContain('20 días hábiles');
 });
 test('omite p0 en la salida y conserva p1, su año dinámico y el formato de referencia',async()=>{
  const values={};for(const slot of engine.map.slots)values[slot.key]=slot.expected;values.AUDITED_YEAR='2036';
  const snapshot=engine.snapshot(values),sections=engine.sections(snapshot);
  expect(sections.find(section=>section.clauseKey==='p0').body).toBe(engine.map.paragraphs[0]);
  expect(sections.find(section=>section.clauseKey==='p1').body).toContain('2036');
  expect(sections.find(section=>section.clauseKey==='p5').clauseKey).toBe('p5');
  expect(sections.find(section=>section.clauseKey==='p57').clauseKey).toBe('p57');
  expect(sections.find(section=>section.clauseKey==='p60').clauseKey).toBe('p60');
  const result=await JSZip.loadAsync(await engine.docx(snapshot,sections));
  const xml=await result.file('word/document.xml').async('string');
  const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>/g)].map(match=>match[0]);
  const text=paragraph=>paragraph.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  const title='CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES DE AUDITORIA EXTERNA A LOS ESTADOS FINANCIEROS POR EL AÑO TERMINADO AL 31 DE DICIEMBRE DEL 2036';
  expect(paragraphs.map(text).filter(body=>body.startsWith('CONTRATO DE PRESTACION'))).toEqual([title]);
  expect(paragraphs.map(text)[0]).toBe(title);
  expect(paragraphs.map(text)[1]).toMatch(/^PRIMERA\. - COMPARECIENTES\./);
  const titleXml=paragraphs.find(paragraph=>text(paragraph)===title);
  expect(titleXml).toContain('<w:b/>');
  expect(titleXml).toContain('<w:u w:val="single"/>');
 });
 test('usa el año guardado en el body de p1 para el DOCX sin sincronizar el snapshot',async()=>{
  const values={};for(const slot of engine.map.slots)values[slot.key]=slot.expected;values.AUDITED_YEAR='2026';
  const snapshot=engine.snapshot(values),sections=engine.sections(snapshot);
  const p1=sections.find(section=>section.clauseKey==='p1');
  p1.body=p1.body.replace('2026','2027');
  const result=await JSZip.loadAsync(await engine.docx(snapshot,sections));
  const xml=await result.file('word/document.xml').async('string');
  const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>|<w:p\/>/g)].map(match=>match[0]);
  const text=paragraph=>paragraph.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'");
  expect(paragraphs.map(text).filter(body=>body.startsWith('CONTRATO DE PRESTACION'))).toEqual([p1.body]);
  expect(p1.body).toContain('DICIEMBRE DEL 2027');
  expect(snapshot.values.AUDITED_YEAR).toBe('2026');
 });
 test('UAFE se genera como párrafo DOCX oficial independiente entre p57 y p58',async()=>{
  const values={};for(const slot of engine.map.slots)values[slot.key]=slot.expected;
  const snapshot=engine.snapshot(values),sections=prepareNewOfficialContractSections(engine.sections(snapshot));
  const result=await JSZip.loadAsync(await engine.docx(snapshot,sections));
  const xml=await result.file('word/document.xml').async('string');
  const paragraphs=[...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(match=>[...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(text=>text[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'")).join(''));
  const uafeIndex=paragraphs.indexOf(OFFICIAL_UAFE_BODY);
  expect(sections.find(section=>section.clauseKey===OFFICIAL_UAFE_CLAUSE_KEY).isCustom).toBe(false);
  expect(uafeIndex).toBeGreaterThan(paragraphs.findIndex(body=>body.startsWith('DECIMA. - CONFIDENCIALIDAD.')));
  expect(uafeIndex).toBeLessThan(paragraphs.findIndex(body=>body.startsWith('DÉCIMA PRIMERA')));
 });
 test('mantiene representante y auditor en columnas semánticas independientes',async()=>{
  const values={};for(const slot of engine.map.slots)values[slot.key]=slot.expected;
  values.COMPANY_NAME='RCA';values.REPRESENTATIVE_NAME='MARIZOL CEPEDA CASTRO';values.REPRESENTATIVE_POSITION='GERENTE GENERAL';
  const snapshot=engine.snapshot(values),sections=engine.sections(snapshot);
  sections.find(s=>s.clauseKey==='p62').body='MARIZOL CEPEDA CASTRO        Ing. CPA. Carlos Andrés Mendoza Vélez';
  sections.find(s=>s.clauseKey==='p63').body='GERENTE GENERAL        AUDITOR EXTERNO No. SCVS-RNAE-3185';
  sections.find(s=>s.clauseKey==='p64').body='RCA';
  const result=await JSZip.loadAsync(await engine.docx(snapshot,sections));
  const xml=await result.file('word/document.xml').async('string');
  const table=[...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].at(-1)[0];
  const cells=[...table.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(match=>match[0].replace(/<[^>]+>/g,''));
  expect(cells).toEqual(['MARIZOL CEPEDA CASTRO','Ing. CPA. Carlos Andrés Mendoza Vélez','GERENTE GENERAL','AUDITOR EXTERNO No. SCVS-RNAE-3185','RCA','']);
expect(cells[0]+cells[2]+cells[4]).not.toMatch(/Carlos|SCVS-RNAE-3185/);
  expect(cells[1]+cells[3]+cells[5]).not.toMatch(/RCA|SOCIO CONSULTOR/);
 });
 test('reconstruye firmas ordenadas cuando el cuerpo guardado quedó con un solo firmante',async()=>{
  const values={};for(const slot of engine.map.slots)values[slot.key]=slot.expected;
  values.COMPANY_NAME='RCA';values.REPRESENTATIVE_NAME='MARIZOL CEPEDA CASTRO';values.REPRESENTATIVE_POSITION='GERENTE GENERAL';
  const snapshot=engine.snapshot(values),sections=engine.sections(snapshot);
  snapshot.AUDITOR={professionalTitles:'Ing. CPA.',fullName:'Carlos Andrés Mendoza Vélez',position:'GERENTE GENERAL',ruc:'9999999999001',externalAuditorRegistration:'SCVS-RNAE-3185',judicialExpertNumber:'',accountantLicenseNumber:'',address:'',phone:'',email:''};
  sections.find(s=>s.clauseKey==='p62').body='Ing. CPA. Carlos Andrés Mendoza Vélez';
  sections.find(s=>s.clauseKey==='p63').body='GERENTE GENERAL        AUDITOR EXTERNO No. SCVS-RNAE-3185';
  sections.find(s=>s.clauseKey==='p64').body='RCA';
  const result=await JSZip.loadAsync(await engine.docx(snapshot,sections));
  const xml=await result.file('word/document.xml').async('string');
  const table=[...xml.matchAll(/<w:tbl>[\s\S]*?<\/w:tbl>/g)].at(-1)[0];
  const cells=[...table.matchAll(/<w:tc>[\s\S]*?<\/w:tc>/g)].map(match=>match[0].replace(/<[^>]+>/g,''));
  expect(cells).toEqual(['MARIZOL CEPEDA CASTRO','Ing. CPA. Carlos Andrés Mendoza Vélez','GERENTE GENERAL','AUDITOR EXTERNO No. SCVS-RNAE-3185','RCA','']);
 });
});

