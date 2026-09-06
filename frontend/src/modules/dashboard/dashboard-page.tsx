import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/use-auth';
import { DashboardIcon, type IconName } from '../../components/dashboard/dashboard-icon';
const assets = '/images/dashboard/';
function DashboardDate() {
 const [now, setNow] = useState(() => new Date());
 useEffect(() => {
  const refresh = () => setNow(new Date());
  const timer = window.setInterval(refresh, 1000);
  window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
  return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
 }, []);
 const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('es-EC', { ...options, timeZone: 'America/Guayaquil' }).format(now);
 return <time className="dashboard-date" dateTime={format({ year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-')}><span>{format({ weekday: 'long' })}</span><strong>{format({ day: '2-digit' })}</strong><span>{format({ month: 'long' })} {format({ year: 'numeric' })}</span></time>;
}
function WelcomeHero() {
 const { user } = useAuth();
 return <section className="welcome-hero" aria-labelledby="welcome-title"><img className="welcome-image" src={`${assets}hero-dashboard.png`} alt="Escritorio con libros de auditoría, estrategia y crecimiento, taza, laptop y libreta" /><div className="welcome-copy"><p className="dashboard-eyebrow">Auditoría <span>•</span> Confianza <span>•</span> Valor</p><h1 id="welcome-title">Bienvenido, {user?.firstName || 'Usuario'}</h1><p className="welcome-subtitle">Sistema de Gestión de Auditoría</p><div className="welcome-rule" /><blockquote>“La auditoría no solo revisa números,<br className="desktop-break" /> fortalece empresas.</blockquote><p className="welcome-firm">Auditores Independientes Espinoza &amp; Asociados</p></div><DashboardDate /></section>;
}
const actions: { title: string; description: string; image: string; icon: IconName; to: string; tone: string }[] = [
 { title: 'Preparar un contrato', description: 'Utilice nuestras plantillas y genere contratos personalizados.', image: 'card-contrato.png', icon: 'file', to: '/contracts', tone: 'orange' },
 { title: 'Trabajar con información financiera', description: 'Cargue y procese estados financieros para su análisis.', image: 'card-finanzas.png', icon: 'chart', to: '/documents', tone: 'rose' },
 { title: 'Preparar un informe', description: 'Genere informes de auditoría con un formato profesional.', image: 'card-informe.png', icon: 'file', to: '/reports', tone: 'gold' },
];
function DashboardActionCard({ action }: { action: typeof actions[number] }) {
 return <Link to={action.to} className={`dashboard-action ${action.tone}`}><img src={`${assets}${action.image}`} alt="" /><div className="dashboard-action-copy"><span className="dashboard-action-icon"><DashboardIcon name={action.icon} /></span><h3>{action.title}</h3><p>{action.description}</p></div><span className="dashboard-action-arrow"><DashboardIcon name="arrow" /></span></Link>;
}
function CommitmentBanner() {
 return <section className="commitment-banner" aria-labelledby="commitment-title"><div className="commitment-copy"><p className="dashboard-eyebrow">Nuestro compromiso</p><h2 id="commitment-title">Precisión en cada proceso.<br />Confianza en cada resultado.</h2><p>Una gestión organizada, segura y profesional<br className="desktop-break" /> para respaldar cada proceso de auditoría.</p></div><img src={`${assets}banner-compromiso.png`} alt="Ética, Experiencia, Confianza. Resultados que generan valor" /></section>;
}
export function DashboardPage() {
 return <div className="dashboard-page"><WelcomeHero /><div className="dashboard-content"><section className="dashboard-actions" aria-labelledby="actions-title"><h2 id="actions-title">¿Qué desea hacer hoy?</h2><p>Acceda rápidamente a las principales herramientas de su trabajo.</p><div className="dashboard-action-grid">{actions.map(action => <DashboardActionCard key={action.to} action={action} />)}</div></section><CommitmentBanner /><footer className="dashboard-footer"><span>Auditores Independientes Espinoza &amp; Asociados</span><span>Sistema de Gestión de Auditoría <i /> v1.0.0</span></footer></div></div>;
}
