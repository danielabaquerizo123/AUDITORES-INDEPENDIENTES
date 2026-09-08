import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { cleanup,fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter,Route,Routes } from 'react-router-dom';
import { beforeEach,expect,it,vi } from 'vitest';
import { ContractDocumentPage } from './contract-document-page';
const {getContract,updateClause,createParagraph,deleteClause}=vi.hoisted(()=>({getContract:vi.fn(),updateClause:vi.fn(),createParagraph:vi.fn(),deleteClause:vi.fn()}));
vi.mock('./services/contracts.api',()=>({contractsApi:{getContract,updateClause,createParagraph,deleteClause,generateDocument:vi.fn(),downloadDocument:vi.fn()}}));
const clauses=[
 {id:'cl0',clauseKey:'p0',title:'Título del contrato',body:'CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES',sortOrder:0,enabled:true},
 {id:'cl10',clauseKey:'p10',title:'Sección 10',body:'Efectuar la auditoría de los estados financieros correspondientes al año 2025',sortOrder:10,enabled:true},
 {id:'cl47',clauseKey:'p47',title:'Sección 47',body:'OCTAVA - HONORARIOS PARA LA AUDITORÍA. Se establecen en USD $1.500,00 más IVA',sortOrder:47,enabled:true},
 {id:'cl52',clauseKey:'p52',title:'Sección 52',body:'NOVENA - AVISOS Y NOTIFICACIONES. Texto base.',sortOrder:52,enabled:true},
 {id:'cl62',clauseKey:'p62',title:'Sección 62',body:'MARUN RODRIGUEZ EDGAR GUSTAVO         CPA. WILMER ESPINOZA TOALOMBO',sortOrder:62,enabled:true},
];
const contract={id:'ct1',clientId:'c1',auditPeriodId:'p1',templateId:null,contractNumber:null,status:'DRAFT',signingDate:null,effectiveFrom:null,effectiveTo:null,reportDeliveryDate:null,taxReportDeliveryDate:null,informationDeliveryDate:null,draftReportDueDate:null,feeNet:null,currency:'USD',notes:null,updatedAt:'2026-01-01T00:00:00.000Z',variables:{templateVersion:'drivernet-2025-v1'},client:{id:'c1',legalName:'TIA S.A.',taxId:'00001'},auditPeriod:{id:'p1',label:'2026',fiscalYear:2026},clauses};
function show(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/contratos/ct1/editar']}><Routes><Route path="/contratos/:id/editar" element={<ContractDocumentPage edit/>}/></Routes></MemoryRouter></QueryClientProvider>)}
beforeEach(()=>{vi.clearAllMocks();getContract.mockResolvedValue(contract);updateClause.mockImplementation((_:string,id:string,body:string)=>Promise.resolve({...clauses.find(clause=>clause.id===id)!,body}));createParagraph.mockImplementation((_:string,parentId:string,body:string)=>Promise.resolve({id:'custom-1',clauseKey:'custom-1',title:'',body,sortOrder:48,enabled:true,isCustom:true,parentClauseKey:'p47'}));deleteClause.mockResolvedValue({id:'custom-1',deleted:true})});
it('edita una cláusula completa sin afectar las demás',async()=>{
 show();
 await screen.findByText(/Cada cláusula se edita/);
 const editBtn=screen.getByRole('button',{name:'Editar OCTAVA - HONORARIOS PARA LA AUDITORÍA'});
 expect(screen.queryByText(/CONTRATO DE PRESTACION/,{selector:'textarea'})).not.toBeInTheDocument();
 fireEvent.click(editBtn);
 const area=screen.getAllByLabelText('Contenido editable')[0];
 fireEvent.change(area,{target:{value:'OCTAVA - HONORARIOS PARA LA AUDITORÍA. Se establecen en USD $2.500,00 más IVA'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar'}));
 await vi.waitFor(()=>expect(updateClause).toHaveBeenCalledWith('ct1','cl47','OCTAVA - HONORARIOS PARA LA AUDITORÍA. Se establecen en USD $2.500,00 más IVA'));
 expect(await screen.findByRole('status')).toHaveTextContent('Cambios guardados correctamente.');
 expect(screen.getByText(/USD \$2\.500,00/)).toBeInTheDocument();
 expect(screen.getByText(/CPA\. WILMER ESPINOZA TOALOMBO/)).toBeInTheDocument();
});
it('cancelar revierte el bloque sin guardar',async()=>{
 show();
 await screen.findByText(/Cada cláusula se edita/);
 fireEvent.click(screen.getByRole('button',{name:'Editar OCTAVA - HONORARIOS PARA LA AUDITORÍA'}));
 fireEvent.change(screen.getAllByLabelText('Contenido editable')[0],{target:{value:'CAMBIO DESCARTADO'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
 expect(updateClause).not.toHaveBeenCalled();
 expect(screen.getByText(/USD \$1\.500,00/)).toBeInTheDocument();
});
it('agrega al final de la cláusula visible y cancelar no persiste',async()=>{
 show();await screen.findByText(/Cada cláusula se edita/);
 fireEvent.click(screen.getAllByRole('button',{name:'Agregar párrafo'})[0]);
 fireEvent.change(screen.getByLabelText('Nuevo párrafo para OCTAVA - HONORARIOS PARA LA AUDITORÍA'),{target:{value:'Párrafo agregado a OCTAVA.'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar'}));
 await vi.waitFor(()=>expect(createParagraph).toHaveBeenCalledWith('ct1','cl47','Párrafo agregado a OCTAVA.'));
 expect(await screen.findByText('Párrafo agregado a OCTAVA.')).toBeInTheDocument();
 fireEvent.click(screen.getAllByRole('button',{name:'Agregar párrafo'})[0]);
 fireEvent.change(screen.getByLabelText('Nuevo párrafo para OCTAVA - HONORARIOS PARA LA AUDITORÍA'),{target:{value:'Borrador descartado'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
 expect(createParagraph).toHaveBeenCalledTimes(1);expect(screen.queryByDisplayValue('Borrador descartado')).not.toBeInTheDocument();
});
it('asocia PRIMERA, SEGUNDA y TERCERA al clauseId capturado por cada botón',async()=>{
 const threeClauses=[
  {id:'first',clauseKey:'p2',title:'Sección 2',body:'PRIMERA. - COMPARECIENTES. Texto base.',sortOrder:2,enabled:true},
  {id:'second',clauseKey:'p5',title:'Sección 5',body:'SEGUNDA. - ANTECEDENTES. Texto base.',sortOrder:5,enabled:true},
  {id:'third',clauseKey:'p7',title:'Sección 7',body:'TERCERA. - NATURALEZA CONTRACTUAL. Texto base.',sortOrder:7,enabled:true},
 ];
 createParagraph.mockImplementation((_:string,parentId:string,body:string)=>Promise.resolve({id:`custom-${parentId}`,clauseKey:`custom-${parentId}`,title:'',body,sortOrder:parentId==='first'?4:parentId==='second'?6:8,enabled:true,isCustom:true,parentClauseKey:parentId==='first'?'p2':parentId==='second'?'p5':'p7'}));
 for(const [index,label,body,id] of [[0,'PRIMERA. - COMPARECIENTES','PÁRRAFO PRIMERA','first'],[1,'SEGUNDA. - ANTECEDENTES','PÁRRAFO SEGUNDA','second'],[2,'TERCERA. - NATURALEZA CONTRACTUAL','PÁRRAFO TERCERA','third']] as const){
  cleanup();getContract.mockResolvedValue({...contract,clauses:threeClauses});show();await screen.findByText(/PRIMERA/);
  fireEvent.click(screen.getAllByRole('button',{name:'Agregar párrafo'})[index]);
  fireEvent.change(screen.getByLabelText(`Nuevo párrafo para ${label}`),{target:{value:body}});
  fireEvent.click(screen.getByRole('button',{name:'Guardar'}));
  await vi.waitFor(()=>expect(createParagraph).toHaveBeenCalledWith('ct1',id,body));
 }
 expect(createParagraph).toHaveBeenNthCalledWith(1,'ct1','first','PÁRRAFO PRIMERA');
 expect(createParagraph).toHaveBeenNthCalledWith(2,'ct1','second','PÁRRAFO SEGUNDA');
 expect(createParagraph).toHaveBeenNthCalledWith(3,'ct1','third','PÁRRAFO TERCERA');
});
it('edita y elimina solo un párrafo agregado',async()=>{
 const withCustom={...contract,clauses:[...clauses,{id:'custom-1',clauseKey:'custom-1',title:'',body:'Párrafo manual.',sortOrder:48,enabled:true,isCustom:true,parentClauseKey:'p47'}]};getContract.mockResolvedValue(withCustom);show();
 expect(await screen.findByText('Párrafo manual.')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:/^Editar$/}));
 fireEvent.change(screen.getByLabelText('Editar párrafo agregado'),{target:{value:'Párrafo actualizado.'}});fireEvent.click(screen.getByRole('button',{name:'Guardar'}));
 await vi.waitFor(()=>expect(updateClause).toHaveBeenCalledWith('ct1','custom-1','Párrafo actualizado.'));
 fireEvent.click(screen.getByRole('button',{name:/^Eliminar$/}));expect(screen.getByText('¿Desea eliminar este párrafo?')).toBeInTheDocument();
 fireEvent.click(screen.getAllByRole('button',{name:/^Eliminar$/})[1]);await vi.waitFor(()=>expect(deleteClause).toHaveBeenCalledWith('ct1','custom-1'));
});

