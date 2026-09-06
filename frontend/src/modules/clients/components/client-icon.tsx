import type { SVGProps } from 'react';
import { DashboardIcon } from '../../../components/dashboard/dashboard-icon';
import { LoginIcon } from '../../auth/login-icon';
type Name = 'eye' | 'user' | 'edit' | 'back' | 'plus' | 'building' | 'save' | 'note' | 'next' | 'trash';
const paths = {edit:'m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-4-4L4 16ZM4 16l4 4',back:'M20 12H4m6-6-6 6 6 6',plus:'M12 4v16M4 12h16',building:'M3 22V8h6M9 22V2h11v20M1 22h22M13 6h3M13 10h3M13 14h3M13 18h3M5 12v2m0 3v2',save:'M3 3h15l3 3v15H3ZM7 3v6h10V3M7 21v-8h10v8',note:'M5 3h14v19H3V3ZM8 1v4m8-4v4M7 10h8M7 14h8M7 18h5',trash:'M6 2h4a2 2 0 0 1 2 2v4h2a2 2 0 0 1 2 2v4h-4v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2H4Zm3.85-1.15l2.12 2.12a1 1 0 0 1-1.42 1.42L9.83 12l-1.72 1.72a1 1 0 0 1-1.42-1.42l2.13-2.12H5.83a1 1 0 0 1-.83-.35l-1.83 2.66c-.12.17-.08.41.07.55l2 1.83Z'};
export function ClientIcon({name,...props}:SVGProps<SVGSVGElement>&{name:Name}) {
 if(name==='eye'||name==='user') return <LoginIcon name={name} {...props}/>;
 if(name==='next') return <DashboardIcon name="chevron" {...props}/>;
 if(name==='trash') return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d="M3 6h18M9 6V4h6v2M6 6l1 15h10l1-15M10 11v6M14 11v6"/></svg>;
 return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]}/></svg>;
}
