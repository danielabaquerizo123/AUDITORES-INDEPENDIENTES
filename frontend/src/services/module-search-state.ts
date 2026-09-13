export type ModuleSearchKey='clients'|'auditors'|'contracts';
const prefix='module-search:';
export function readModuleSearch<T>(key:ModuleSearchKey,fallback:T):T{
 try{const value=sessionStorage.getItem(prefix+key);return value?JSON.parse(value) as T:fallback}catch{return fallback}
}
export function writeModuleSearch<T>(key:ModuleSearchKey,value:T){sessionStorage.setItem(prefix+key,JSON.stringify(value))}
export function clearModuleSearches(){(['clients','auditors','contracts'] as const).forEach(key=>sessionStorage.removeItem(prefix+key))}
