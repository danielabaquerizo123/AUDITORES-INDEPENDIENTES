import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { session } from '../services/session';
import { useAuth } from './use-auth';

// Auth state will be connected to the API when the authentication flow is implemented.
export function PrivateRoute() {
  const location = useLocation();
  const { isAuthenticated }=useAuth(); return session.token && isAuthenticated ? <Outlet /> : <Navigate to="/login" replace state={{ from: location }} />;
}
