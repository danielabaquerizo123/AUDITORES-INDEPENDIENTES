import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { session } from '../services/session';
import { httpClient } from '../services/http-client';
import { clearModuleSearches } from '../services/module-search-state';
import { login as requestLogin, me, refresh } from '../modules/auth/services/auth.api';
import { AuthContext, type User } from './auth-store';
export function AuthProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [isRestoring,setIsRestoring]=useState(true);const queryClient=useQueryClient();
 const clear=useCallback(()=>{session.set(null);clearModuleSearches();setUser(null);queryClient.clear()},[queryClient]);
 useEffect(()=>{session.onUnauthorized(clear);return()=>session.onUnauthorized(null)},[clear]);
 useEffect(()=>{let cancelled=false;(async()=>{try{const result=await refresh();session.set(result.accessToken);const current=await me();if(!cancelled)setUser(current)}catch{if(!cancelled)clear()}finally{if(!cancelled)setIsRestoring(false)}})();return()=>{cancelled=true}},[clear]);
 const login=async(email:string,password:string)=>{const result=await requestLogin(email,password);session.set(result.accessToken);try{setUser(await me())}catch(error){clear();throw error}};
 const logout=async()=>{try{await httpClient.post('/auth/logout')}finally{clear()}};
 return <AuthContext.Provider value={{user,isAuthenticated:!!user,isRestoring,login,logout,hasPermission:p=>!!user?.permissions.includes(p)}}>{children}</AuthContext.Provider>;
}
