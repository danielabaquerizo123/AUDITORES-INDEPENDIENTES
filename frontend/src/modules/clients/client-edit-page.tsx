import { useParams } from 'react-router-dom';
import { ClientEditor } from './components/client-editor';
export function ClientEditPage() { const {id=''}=useParams();return <ClientEditor id={id}/>; }
