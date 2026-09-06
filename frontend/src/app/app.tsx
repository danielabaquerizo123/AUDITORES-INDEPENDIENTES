import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './routes';
import { AuthProvider } from './auth-context';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });

export function App() {
  return <QueryClientProvider client={queryClient}><AuthProvider><BrowserRouter><AppRoutes /></BrowserRouter></AuthProvider></QueryClientProvider>;
}
