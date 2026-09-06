import { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../app/use-auth';
import { DashboardIcon, type IconName } from '../components/dashboard/dashboard-icon';
import '../styles/dashboard.css';
const links: { to: string; label: string; icon: IconName }[] = [
 { to: '/dashboard', label: 'Dashboard', icon: 'home' }, { to: '/clientes', label: 'Clientes', icon: 'users' },
 { to: '/contratos', label: 'Contratos', icon: 'file' }, { to: '/documents', label: 'Carga de Archivos', icon: 'upload' },
 { to: '/reports', label: 'Informes', icon: 'chart' }, { to: '/settings', label: 'Configuración', icon: 'settings' },
];
function Sidebar({ open, close }: { open: boolean; close: () => void }) {
 return <><button className={`dashboard-scrim ${open ? 'is-open' : ''}`} onClick={close} aria-label="Cerrar navegación" tabIndex={open ? 0 : -1} />
 <aside className={`dashboard-sidebar ${open ? 'is-open' : ''}`} id="dashboard-navigation">
  <NavLink to="/dashboard" className="dashboard-brand" onClick={close}><img src="/images/dashboard/logo-espinoza.png" alt="" /><span>Auditores Independientes<br />Espinoza &amp; Asociados</span></NavLink>
  <nav aria-label="Navegación principal">{links.map(link => <NavLink key={link.to} to={link.to} onClick={close} className={({ isActive }) => `dashboard-nav-link ${isActive ? 'is-active' : ''}`}><DashboardIcon name={link.icon} /><span>{link.label}</span></NavLink>)}</nav>
  <blockquote className="sidebar-quote">“Comprometidos con<br />la transparencia<br />y la confianza”</blockquote>
 </aside></>;
}
function DashboardHeader({ toggle, open }: { toggle: () => void; open: boolean }) {
 const { user, logout } = useAuth(); const navigate = useNavigate();
 const location = useLocation(); const [searchParams] = useSearchParams(); const isClients = /^\/(clientes|clients)(\/|$)/.test(location.pathname);
 const name = [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'Usuario';
 const initials = name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
 return <header className="dashboard-header">
  <button className="dashboard-menu" onClick={toggle} aria-label="Abrir navegación" aria-expanded={open} aria-controls="dashboard-navigation"><DashboardIcon name="menu" /></button>
  <div className="dashboard-search" title={isClients ? undefined : "Búsqueda global aún no disponible"}><DashboardIcon name="search" />{isClients ? <input key="clients-search" aria-label="Buscar empresa, RUC o representante" placeholder="Buscar empresa, RUC o representante..." value={searchParams.get("q") ?? ""} onChange={event => navigate(`/clientes?q=${encodeURIComponent(event.target.value)}`, { replace: true })} /> : <input key="global-search" aria-label="Buscar empresa, RUC o documento (próximamente)" placeholder="Buscar empresa, RUC o documento..." disabled />}</div>
  <span className="dashboard-bell" title="Notificaciones aún no disponibles" aria-label="Notificaciones aún no disponibles"><DashboardIcon name="bell" /></span>
  <details className="dashboard-account"><summary><span className="dashboard-avatar">{initials}</span><span className="dashboard-account-name"><strong>{name}</strong><small>Usuario único</small></span><DashboardIcon name="chevron" /></summary><div className="dashboard-account-menu"><button onClick={async () => { await logout(); navigate('/login', { replace: true }); }}>Salir</button></div></details>
 </header>;
}
export function AppLayout() {
 const [open, setOpen] = useState(false);
 const location = useLocation(); const isClients = /^\/(clientes|clients)(\/|$)/.test(location.pathname);
 return <div className={`dashboard-shell${isClients ? " clients-shell" : ""}`} onKeyDown={event => { if (event.key === 'Escape') setOpen(false); }}><Sidebar open={open} close={() => setOpen(false)} /><div className="dashboard-workspace"><DashboardHeader open={open} toggle={() => setOpen(!open)} /><main className="dashboard-main"><Outlet /></main></div></div>;
}


