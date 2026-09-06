import type { SVGProps } from 'react';
import { DashboardIcon } from '../../components/dashboard/dashboard-icon';
type LoginIconName = 'user' | 'lock' | 'eye' | 'eye-off' | 'shield' | 'file' | 'chart' | 'arrow';
const paths = {
 user: 'M20 21v-2a6 6 0 0 0-6-6h-4a6 6 0 0 0-6 6v2M16 6a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 lock: 'M6 10h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2ZM8 10V6a4 4 0 0 1 8 0v4',
 eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12ZM15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
 'eye-off': 'm3 21 18-18M9 5.5A12 12 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-4 4.5M6 7a19 19 0 0 0-4 5s3 7 10 7a12 12 0 0 0 4-.7M10 14a3 3 0 0 1 4-4',
 shield: 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6',
};
export function LoginIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: LoginIconName }) {
 if (name === 'file' || name === 'chart' || name === 'arrow') return <DashboardIcon name={name} {...props} />;
 return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
