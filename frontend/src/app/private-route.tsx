import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { session } from '../services/session';
import { useAuth } from './use-auth';

export function PrivateRoute() {
  const location = useLocation();
  const { isAuthenticated, isRestoring }=useAuth();
  if (isRestoring) return <p role="status" aria-live="polite">Verificando sesión...</p>;
  return session.token && isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}
