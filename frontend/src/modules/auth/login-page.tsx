import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/use-auth';
import { LoginIcon } from './login-icon';
import packageInfo from '../../../package.json';
import '../../styles/login.css';

function LoginInstitutionalContent() {
 return <>
  <section className="login-message" aria-label="Nuestro compromiso"><span className="login-accent" /><h2>Confianza<br />en cada<br /><em>decisión.</em></h2><p className="login-values">AUDITORÍA · TRANSPARENCIA · VALOR</p><span className="login-accent" /><blockquote>“Comprometidos con<br />la transparencia<br />y el crecimiento<br />sostenible.”</blockquote></section>
  <div className="login-principles"><p>INTEGRIDAD<br />CONOCIMIENTO<br />SOLUCIONES</p><span className="login-accent" /></div>
  <section className="login-benefits" aria-label="Nuestros principios"><div><LoginIcon name="file" /><p>INFORMACIÓN<br />CONFIABLE</p></div><div><LoginIcon name="shield" /><p>PROCESOS<br />MÁS SEGUROS</p></div><div><LoginIcon name="chart" /><p>ORGANIZACIONES<br />MÁS SÓLIDAS</p></div></section>
  <blockquote className="login-closing">“El orden hoy,<br />genera mejores resultados mañana.”<span className="login-accent" /></blockquote>
 </>;
}
export function LoginPage() {
 const [email, setEmail] = useState('');
 const [password, setPassword] = useState('');
 const [showPassword, setShowPassword] = useState(false);
 const [error, setError] = useState('');
 const [loading, setLoading] = useState(false);
 const nav = useNavigate();
 const auth = useAuth();
 if (auth.isAuthenticated) return <Navigate to="/dashboard" replace />;
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setLoading(true); setError('');
  try { await auth.login(email, password); nav('/dashboard'); }
  catch { setError('No fue posible iniciar sesión. Verifique sus credenciales.'); }
  finally { setLoading(false); }
 }
 return <main className="login-page">
  <img className="login-background" src="/images/login/login-background.png" alt="" />
  <LoginInstitutionalContent />
  <section className="login-panel" aria-labelledby="login-brand-title">
   <div className="login-brand"><img src="/images/dashboard/logo-espinoza.png" alt="" /><h1 id="login-brand-title">Auditores Independientes<br />Espinoza &amp; Asociados</h1><span className="login-accent" /><p>SISTEMA DE GESTIÓN DE AUDITORÍA</p></div>
   <form onSubmit={submit} aria-label="Iniciar sesión" aria-busy={loading}>
    <label className="login-field"><span className="login-sr-only">Usuario</span><LoginIcon name="user" /><input type="email" required autoComplete="username" aria-label="Usuario" placeholder="Usuario" value={email} onChange={event => setEmail(event.target.value)} /></label>
    <label className="login-field"><span className="login-sr-only">Contraseña</span><LoginIcon name="lock" /><input id="login-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Contraseña" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" className="login-password-toggle" aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'} aria-controls="login-password" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}><LoginIcon name={showPassword ? 'eye' : 'eye-off'} /></button></label>
    <label className="login-remember" title="La sesión actual se conserva únicamente mientras la aplicación permanece abierta"><input type="checkbox" name="remember" />Recordar mi sesión</label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button className="login-submit" type="submit" disabled={loading}><span>{loading ? 'Ingresando...' : 'Ingresar'}</span><LoginIcon name="arrow" /></button>
   </form>
   <p className="login-access">Acceso exclusivo para usuarios autorizados</p>
  </section>
  <footer className="login-footer"><span className="login-accent" /><p>Auditores Independientes Espinoza &amp; Asociados</p><small>Sistema de Gestión de Auditoría <span>|</span> v{packageInfo.version}</small></footer>
 </main>;
}

