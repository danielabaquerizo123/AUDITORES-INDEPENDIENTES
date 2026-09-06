import type { SVGProps } from 'react';
export type IconName = 'home' | 'users' | 'file' | 'upload' | 'chart' | 'settings' | 'search' | 'bell' | 'arrow' | 'chevron' | 'menu';
const paths: Record<IconName, string> = {
 home: 'm3 11 9-8 9 8M5 10v11h5v-7h4v7h5V10',
 users: 'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3M16 4a4 4 0 0 1 0 8M22 21v-3a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 file: 'M14 2H4v20h16V8Zm0 0v6h6M8 12h8M8 16h8M8 8h2',
 upload: 'M7 18H5a4 4 0 0 1-1-7.87 7 7 0 0 1 13.9-2A5 5 0 0 1 19 18h-2M12 22V10m-4 4 4-4 4 4',
 chart: 'M2 22h20M5 22V12h4v10M10 22V7h4v15M15 22V2h4v20',
 settings: 'm9 3 1-2h4l1 2 3 2 2 0 2 4-1 2v3l1 2-2 4h-2l-3 2-1 1h-4l-1-1-3-2H4l-2-4 1-2v-3L2 9l2-4h2ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
 bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10M10 22h4M12 2V0',
 arrow: 'M5 12h14m-6-6 6 6-6 6', chevron: 'm6 9 6 6 6-6', menu: 'M3 6h18M3 12h18M3 18h18',
};
export function DashboardIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
 return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[name]} /></svg>;
}
