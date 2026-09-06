import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import { fireEvent,render,screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach,expect,it,vi } from 'vitest';
import { ContractDocumentPage } from './contract-document-page';
const {getContract,updateContract}=vi.hoisted(()=>({getContract:vi.fn(),updateContract:vi.fn()}));
vi.mock('./services/contracts.api',()=>({contractsApi:{getContract,updateContract,generateDocument:vi.fn(),downloadDocument:vi.fn()}}));
const clauses=[
 {clauseKey:'p0',title:'Título del contrato',body:'CONTRATO DE PRESTACION DE SERVICIOS PROFESIONALES',sortOrder:0},
 {clauseKey:'p10',title:'Sección 10',body:'Efectuar la auditoría de los estados financieros correspondientes al año 2025',sortOrder:10},
 {clauseKey:'p47',title:'Sección 47',body:'OCTAVA - HONORARIOS PARA LA AUDITORÍA. Se establecen en USD $1.500,00 más IVA',sortOrder:47},
 {clauseKey:'p62',title:'Sección 62',body:'MARUN RODRIGUEZ EDGAR GUSTAVO         CPA. WILMER ESPINOZA TOALOMBO',sortOrder:62},
];
const contract={id:'ct1',clientId:'c1',auditPeriodId:'p1',templateId:null,contractNumber:null,status:'DRAFT',signingDate:null,effectiveFrom:null,effectiveTo:null,reportDeliveryDate:null,taxReportDeliveryDate:null,informationDeliveryDate:null,draftReportDueDate:null,feeNet:null,currency:'USD',notes:null,updatedAt:'2026-01-01T00:00:00.000Z',variables:{templateVersion:'drivernet-2025-v1'},client:{id:'c1',legalName:'TIA S.A.',taxId:'00001'},auditPeriod:{id:'p1',label:'2026',fiscalYear:2026},clauses};
function show(){render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><ContractDocumentPage edit/></MemoryRouter></QueryClientProvider>)}
beforeEach(()=>{vi.clearAllMocks();getContract.mockResolvedValue(contract);updateContract.mockResolvedValue(contract)});
it('bloquea texto fijo y permite editar solo honorarios',async()=>{
 show();
 await screen.findByText(/Solo las secciones variables/);
 expect(screen.getByText(/Efectuar la auditoría/)).toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Editar Fecha del borrador del informe'})).not.toBeInTheDocument();
 const editBtn=screen.getByRole('button',{name:'Editar Honorarios y forma de pago'});
 expect(screen.queryByText(/CONTRATO DE PRESTACION/,{selector:'textarea'})).not.toBeInTheDocument();
 fireEvent.click(editBtn);
 const area=screen.getByLabelText('Contenido editable');
 fireEvent.change(area,{target:{value:'OCTAVA - HONORARIOS PARA LA AUDITORÍA. Se establecen en USD $2.500,00 más IVA'}});
 fireEvent.click(screen.getByRole('button',{name:'Guardar'}));
 await vi.waitFor(()=>expect(updateContract).toHaveBeenCalledTimes(1));
 const payload=updateContract.mock.calls[0][1] as {sections:{clauseKey:string;body:string}[]};
 expect(payload.sections).toHaveLength(4);
 expect(payload.sections.find(s=>s.clauseKey==='p47')?.body).toContain('USD $2.500,00');
 expect(payload.sections.find(s=>s.clauseKey==='p10')?.body).toContain('Efectuar la auditoría');
 expect(payload.sections.find(s=>s.clauseKey==='p62')?.body).toContain('CPA. WILMER ESPINOZA TOALOMBO');
});
it('cancelar revierte el bloque sin guardar',async()=>{
 show();
 await screen.findByText(/Solo las secciones variables/);
 fireEvent.click(screen.getByRole('button',{name:'Editar Honorarios y forma de pago'}));
 fireEvent.change(screen.getByLabelText('Contenido editable'),{target:{value:'CAMBIO DESCARTADO'}});
 fireEvent.click(screen.getByRole('button',{name:'Cancelar'}));
 expect(updateContract).not.toHaveBeenCalled();
 expect(screen.getByText(/USD \$1\.500,00/)).toBeInTheDocument();
});
