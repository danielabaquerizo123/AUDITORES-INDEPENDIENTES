import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { contractsApi } from './services/contracts.api';
import { getApiStatus } from '../clients/services/clients.api';
import { Breadcrumbs } from '../clients/components/breadcrumbs';
import { toDateInput } from './schemas/contract.schema';

export function ContractPreviewPage() {
  const { id = '' } = useParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['contracts', id, 'preview'],
    queryFn: () => contractsApi.getPreview(id),
    retry: false,
  });

  if (query.isLoading) return <p className="mt-6 text-slate-600">Cargando vista previa...</p>;

  if (query.isError) {
    const status = getApiStatus(query.error);
    if (status === 404) {
      return (
        <section aria-label="Vista previa del contrato">
          <Breadcrumbs
            items={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: 'Clientes', to: '/clients' },
            ]}
          />
          <p role="alert" className="mt-6 rounded border bg-white p-6 text-slate-700">
            Contrato no encontrado.{' '}
            <Link className="text-blue-900 underline" to="/clients">
              Volver a clientes
            </Link>
          </p>
        </section>
      );
    }
    return (
      <section aria-label="Vista previa del contrato">
        <Breadcrumbs
          items={[
            { label: 'Dashboard', to: '/dashboard' },
            { label: 'Clientes', to: '/clients' },
          ]}
        />
        <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-red-800">
          {status === 403
            ? 'Acceso denegado. No tiene permiso para ver este contrato.'
            : 'No fue posible cargar la vista previa.'}{' '}
          <button className="underline" onClick={() => query.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    );
  }

  const preview = query.data;

  if (!preview) {
    return (
      <section aria-label="Vista previa del contrato">
        <p role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-red-800">
          No fue posible cargar la vista previa.{' '}
          <button className="underline" onClick={() => query.refetch()}>
            Reintentar
          </button>
        </p>
      </section>
    );
  }

  const { contract, sections, validation } = preview;

  return (
    <section aria-label="Vista previa del contrato">
      <Breadcrumbs
        items={[
          { label: 'Dashboard', to: '/dashboard' },
          { label: 'Clientes', to: '/clients' },
          ...(contract.client
            ? [{ label: contract.client.legalName, to: `/clients/${contract.clientId}` }]
            : []),
          ...(contract.auditPeriod
            ? [
                {
                  label: `Auditoría ${contract.auditPeriod.fiscalYear}`,
                  to: `/clients/${contract.clientId}/audit-periods/${contract.auditPeriodId}`,
                },
              ]
            : []),
          { label: 'Vista previa' },
        ]}
      />
      <h1 className="mt-2 text-2xl font-bold">
        Contrato de auditoría {contract.auditPeriod?.fiscalYear ?? ''}
        {contract.client ? ` — ${contract.client.legalName}` : ''}
      </h1>
      <p className="text-slate-600">
        {contract.contractNumber ? `N.º ${contract.contractNumber} · ` : ''}Estado:{' '}
        {contract.status} · Firma: {toDateInput(contract.signingDate) || '—'} · Honorarios:{' '}
        {contract.feeNet ? `${contract.feeNet} ${contract.currency}` : '—'}
      </p>

      {!validation.valid && (
        <div role="alert" className="mt-6 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Variables pendientes de resolver:</p>
          <ul className="mt-2 list-disc pl-5">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <article className="mt-6 rounded-lg border border-slate-200 bg-white p-6 sm:p-8">
        {sections.map((section) => (
          <section key={section.clauseKey} className="mb-6 last:mb-0">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            {section.body.split(/\n{2,}|\n/).map((paragraph, index) => (
              <p key={`${section.clauseKey}-${index}`} className="mt-2 text-sm leading-relaxed text-slate-800">
                {paragraph}
              </p>
            ))}
          </section>
        ))}
      </article>
    </section>
  );
}
