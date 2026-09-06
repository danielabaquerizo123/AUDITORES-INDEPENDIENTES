import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { auditPeriodsApi } from './services/audit-periods.api';
import { getApiStatus } from '../clients/services/clients.api';
import { Breadcrumbs } from '../clients/components/breadcrumbs';
import { ContractSection } from '../contracts/components/contract-section';
import { FinancialSection } from '../financial-statements/components/financial-section';
import { toDateInput } from './schemas/audit-period.schema';

type Tab =
  | 'resumen'
  | 'contrato'
  | 'estados'
  | 'materialidad'
  | 'papeles'
  | 'informes'
  | 'documentos';

const tabs: { id: Tab; label: string }[] = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'contrato', label: 'Contrato' },
  { id: 'estados', label: 'Estados Financieros' },
  { id: 'materialidad', label: 'Materialidad' },
  { id: 'papeles', label: 'Papeles de Trabajo' },
  { id: 'informes', label: 'Informes' },
  { id: 'documentos', label: 'Documentos' },
];

const futureMessage: Record<Exclude<Tab, 'resumen'>, string> = {
  contrato: 'El contrato se implementará en Fase 4.',
  estados: 'Se implementará en una fase posterior.',
  materialidad: 'Se implementará en una fase posterior.',
  papeles: 'Se implementará en una fase posterior.',
  informes: 'Se implementará en una fase posterior.',
  documentos: 'Se implementará en una fase posterior.',
};

export function AuditPeriodDetailPage() {
  const { clientId = '', periodId = '' } = useParams<{
    clientId: string;
    periodId: string;
  }>();
  const [tab, setTab] = useState<Tab>('resumen');
  const query = useQuery({
    queryKey: ['audit-periods', periodId],
    queryFn: () => auditPeriodsApi.getAuditPeriod(periodId),
  });

  if (query.isLoading) return <p className="mt-6 text-slate-600">Cargando período...</p>;

  if (query.isError) {
    const status = getApiStatus(query.error);
    if (status === 404) {
      return (
        <section aria-label="Detalle del período">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Clientes', to: '/clients' },
            ]}
          />
          <p role="alert" className="mt-6 rounded border bg-white p-6 text-slate-700">
            Período de auditoría no encontrado.{' '}
            <Link className="text-blue-900 underline" to={`/clients/${clientId}`}>
              Volver al cliente
            </Link>
          </p>
        </section>
      );
    }
    return (
      <section aria-label="Detalle del período">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Clientes', to: '/clients' },
          ]}
        />
        <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {status === 403
            ? 'Acceso denegado. No tiene permiso para ver este período.'
            : 'No fue posible cargar el período.'}{' '}
          <button className="underline" onClick={() => query.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    );
  }

  const period = query.data;

  if (!period) {
    return (
      <section aria-label="Detalle del período">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Clientes', to: '/clients' },
          ]}
        />
        <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-red-800">
          No fue posible cargar el período.{' '}
          <button className="underline" onClick={() => query.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Detalle del período">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Clientes', to: '/clients' },
          { label: period.client.legalName, to: `/clients/${period.client.id}` },
          { label: `Auditoría ${period.fiscalYear}` },
        ]}
      />
      <div className="mt-2">
        <h1 className="text-2xl font-bold">{period.client.legalName}</h1>
        <p className="text-slate-600">
          Auditoría {period.fiscalYear} · Estado: {period.status}
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Secciones de la auditoría"
        className="mt-6 flex flex-wrap gap-2"
      >
        {tabs.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`rounded-md px-4 py-2 text-sm font-medium ${
              tab === item.id
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'resumen' && (
        <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Resumen del período</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Cliente</dt>
              <dd className="font-medium">{period.client.legalName}</dd>
            </div>
            <div>
              <dt className="text-slate-500">RUC</dt>
              <dd>{period.client.taxId}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Etiqueta</dt>
              <dd>{period.label}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Año fiscal</dt>
              <dd className="font-medium">{period.fiscalYear}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Fecha de inicio</dt>
              <dd>{toDateInput(period.startDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Fecha de fin</dt>
              <dd>{toDateInput(period.endDate)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado</dt>
              <dd>{period.status}</dd>
            </div>
          </dl>
        </article>
      )}

      {tab === 'contrato' && <ContractSection periodId={period.id} />}

      {tab === 'estados' && <FinancialSection periodId={period.id} />}

      {tab !== 'resumen' && tab !== 'contrato' && tab !== 'estados' && (
        <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">{tabs.find((item) => item.id === tab)?.label}</h2>
          <p className="mt-2 text-sm text-slate-600">{futureMessage[tab]}</p>
        </article>
      )}
    </section>
  );
}
