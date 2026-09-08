import { ContractPreparePage } from '../modules/contracts/contract-prepare-page';
import { ContractDocumentPage } from '../modules/contracts/contract-document-page';
import { Navigate, Route, Routes, useParams, useLocation } from 'react-router-dom';
import { AppLayout } from '../layouts/app-layout';
import { PrivateRoute } from './private-route';
import { LoginPage } from '../modules/auth/login-page';
import { ClientsPage } from '../modules/clients/clients-page';
import { ClientNewPage } from '../modules/clients/client-new-page';
import { ClientDetailPage } from '../modules/clients/client-detail-page';
import { ClientEditPage } from '../modules/clients/client-edit-page';
import { AuditPeriodDetailPage } from '../modules/audit-periods/audit-period-detail-page';
import { ContractPreviewPage } from '../modules/contracts/contract-preview-page';
import { ContractsPage } from '../modules/contracts/contracts-page';
import { DashboardPage } from '../modules/dashboard/dashboard-page';
import { FinancialImportPage } from '../modules/financial-statements/financial-import-page';
import { ReportsPage } from '../modules/reports/reports-page';
import { SettingsPage } from '../modules/settings/settings-page';
import { AuditorsPage } from '../modules/auditors/auditors-page';
import { AuditorEditor } from '../modules/auditors/auditor-editor';
import { AuditorDetailPage } from '../modules/auditors/auditor-detail-page';
import '../styles/page-density.css';

function PlaceholderPage({ title }: { title: string }) {
  return <section><h1 className="text-2xl font-semibold text-slate-900">{title}</h1><p className="mt-2 text-slate-600">Módulo preparado para la siguiente fase.</p></section>;
}

function LegacyClientRedirect({ mode }: { mode?: 'new' | 'edit' }) {
  const { id } = useParams(); const { search } = useLocation();
  const path = mode === 'new' ? '/clientes/nuevo' : id ? `/clientes/${id}${mode === 'edit' ? '/editar' : ''}` : '/clientes';
  return <Navigate to={path + search} replace />;
}

export function AppRoutes() {
  return <Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<PrivateRoute />}>
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/clientes" element={<ClientsPage />} />
        <Route path="/clientes/nuevo" element={<ClientNewPage />} />
        <Route path="/clientes/:id" element={<ClientDetailPage />} />
        <Route path="/clientes/:id/editar" element={<ClientEditPage />} />
        <Route path="/auditores" element={<AuditorsPage />} />
        <Route path="/auditores/nuevo" element={<AuditorEditor />} />
        <Route path="/auditores/:id" element={<AuditorDetailPage />} />
        <Route path="/auditores/:id/editar" element={<AuditorEditor />} />
        <Route path="/clients" element={<LegacyClientRedirect />} />
        <Route path="/clients/new" element={<LegacyClientRedirect mode="new" />} />
        <Route path="/clients/:id" element={<LegacyClientRedirect />} />
        <Route path="/clients/:id/edit" element={<LegacyClientRedirect mode="edit" />} />
        <Route
          path="/clients/:clientId/audit-periods/:periodId"
          element={<AuditPeriodDetailPage />}
        />
        <Route path="/contracts/:id/preview" element={<ContractPreviewPage />} />
        <Route path="/contracts" element={<Navigate to="/contratos" replace />} />
        <Route path="/contratos" element={<ContractsPage />} />
        <Route path="/contratos/nuevo" element={<ContractPreparePage />} />
        <Route path="/contratos/:id" element={<ContractDocumentPage />} />
        <Route path="/contratos/:id/editar" element={<ContractDocumentPage edit />} />
        <Route path="/documents" element={<FinancialImportPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Route>
    <Route path="*" element={<Navigate to="/dashboard" replace />} />
  </Routes>;
}



