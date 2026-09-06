import { Link } from 'react-router-dom';
import { ClientIcon } from './client-icon';
import { getApiStatus } from '../services/clients.api';
export function BackToClients() { return <Link className="clients-button clients-button-outline" to="/clientes"><ClientIcon name="back"/>Volver a clientes</Link>; }
export function ClientLoadState({loading,error,retry}:{loading:boolean;error?:unknown;retry:()=>void}) {
 const status=getApiStatus(error);
 return <section className="clients-page"><BackToClients/>{loading?<p className="clients-status" role="status">Cargando cliente...</p>:<div className="clients-error" role="alert">{status===404?'Cliente no encontrado.':status===403?'Acceso denegado. No tiene permiso para ver este cliente.':'No fue posible cargar el cliente.'} <button onClick={retry}>Reintentar</button></div>}</section>;
}
