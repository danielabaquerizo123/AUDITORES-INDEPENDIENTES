import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {beforeEach,expect,it,vi} from 'vitest';
import {AuditorsPage} from './auditors-page';
const {list}=vi.hoisted(()=>({list:vi.fn()}));
vi.mock('./services/auditors.api',()=>({auditorsApi:{list,remove:vi.fn()}}));
function show(){return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter><AuditorsPage/></MemoryRouter></QueryClientProvider>)}
beforeEach(()=>{sessionStorage.clear();list.mockResolvedValue({items:[],total:0,page:1,pageSize:5})});
it('no consulta ni muestra auditores antes de buscar',()=>{show();expect(screen.getByText('Realiza una búsqueda para consultar los registros.')).toBeInTheDocument();expect(list).not.toHaveBeenCalled()});
it.each(['Carlos','0912345678','0991234567001','SCVS-RNAE-3185'])('busca auditor por %s y conserva la consulta',async value=>{const view=show();await userEvent.type(screen.getByPlaceholderText('Escriba nombre, cédula, RUC o registro...'),value);await userEvent.click(screen.getByRole('button',{name:'Buscar'}));await vi.waitFor(()=>expect(list).toHaveBeenCalledWith(1,value,expect.any(AbortSignal)));view.unmount();show();expect(screen.getByDisplayValue(value)).toBeInTheDocument()});
