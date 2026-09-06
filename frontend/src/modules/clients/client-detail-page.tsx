import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../app/use-auth';
import { clientsApi } from './services/clients.api';
import { ClientIcon } from './components/client-icon';
import { BackToClients, ClientLoadState } from './components/client-page-state';
import '../../styles/clients.css';
function DataRows({rows}:{rows:[string,string|null|undefined][]}) {return <dl className="clients-data">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'—'}</dd></div>)}</dl>}
export function ClientDetailPage() {
 const {id=''}=useParams();const {hasPermission}=useAuth();const query=useQuery({queryKey:['clients',id],queryFn:()=>clientsApi.getClient(id)});
 if(query.isLoading||query.isError||!query.data)return <ClientLoadState loading={query.isLoading} error={query.error} retry={()=>query.refetch()}/>;
 const client=query.data;const rep=client.representatives?.[0];
 return <section className="clients-page" aria-label="Detalle de cliente"><BackToClients/><div className="clients-heading clients-detail-heading"><div className="clients-company-title"><ClientIcon name="building"/><div><h1>{client.legalName}</h1><p>RUC: {client.taxId}</p></div></div>{hasPermission('clients.update')&&<Link to={`/clientes/${id}/editar`} className="clients-button clients-button-outline"><ClientIcon name="edit"/>Editar cliente</Link>}</div><div className="clients-columns"><section className="clients-card" aria-label="Datos de la empresa"><h2><ClientIcon name="building"/>Datos de la empresa</h2><DataRows rows={[
 ['Razón social',client.legalName],['RUC',client.taxId],['Actividad económica principal',client.economicActivity],['Correo electrónico de la empresa',client.email],
 ]}/></section><section className="clients-card" aria-label="Representante legal"><h2><ClientIcon name="user"/>Representante legal</h2><DataRows rows={[
 ['Tratamiento',rep?.treatment],['Nombre completo',rep?.fullName],['Cédula',rep?.nationalId],['Cargo',rep?.position],
 ]}/></section></div></section>;
}
