jest.setTimeout(30000);
const fs=require('fs');
const JSZip=require('jszip');
const {OfficialContractDocument,patchParagraph}=require('../dist/src/contracts/documents/official-contract-document');
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
  expect(outParas.length).toBe(srcParas.length+3);
  const byKey=Object.fromEntries(sections.map(s=>[s.clauseKey,s.body]));
  const exp060=[];for(let i=0;i<=61;i++)exp060.push(i===61?'':byKey[`p${i}`]);
  expect(outParas.slice(0,62)).toEqual(exp060);
  const split=t=>t.split(/\s{2,}|\t+/).map(x=>x.trim()).filter(Boolean);
  const [nL,nR]=split(byKey.p62),[rL,rR]=split(byKey.p63),[cL]=split(byKey.p64);
  expect(outParas.slice(62)).toEqual([nL,nR,rL,rR,cL,'']);
  expect(xml.replace(/<[^>]+>/g,'')).toContain('20 días hábiles');
 });
});

