import { createContext } from 'react';
export type User={id:string;email:string;firstName:string;lastName:string;organization:{id:string;name:string};roles?:string[];permissions:string[]};
export type Auth={user:User|null;isAuthenticated:boolean;login:(email:string,password:string)=>Promise<void>;logout:()=>Promise<void>;hasPermission:(p:string)=>boolean};
export const AuthContext=createContext<Auth|null>(null);
