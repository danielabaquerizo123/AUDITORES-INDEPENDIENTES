import { useContext } from 'react';
import { AuthContext } from './auth-store';
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('AuthProvider missing');return value};
