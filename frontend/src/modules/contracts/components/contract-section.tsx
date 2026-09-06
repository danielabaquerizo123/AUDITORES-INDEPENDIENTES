import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/use-auth';
import { getApiErrorMessage, getApiStatus } from '../../clients/services/clients.api';
import {
  contractsApi,
  type CreateContractPayload,
  type UpdateContractPayload,
} from '../services/contracts.api';
import {
  createContractSchema,
  toDateInput,
  updateContractSchema,
} from '../schemas/contract.schema';
import { ContractForm } from './contract-form';

interface ContractSectionProps {
  periodId: string;
}

export function ContractSection({ periodId }: ContractSectionProps) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const contractQuery = useQuery({
    queryKey: ['contracts', 'by-period', periodId],
    queryFn: () => contractsApi.getContractByPeriod(periodId),
    retry: false,
  });

  const contractId = contractQuery.data?.id;
  const validationQuery = useQuery({
    queryKey: ['contracts', contractId, 'validation'],
    queryFn: () => contractsApi.getValidation(contractId as string),
    enabled: typeof contractId === 'string',
    retry: false,
  });
  const documentsQuery = useQuery({
    queryKey: ['contracts', contractId, 'documents'],
    queryFn: () => contractsApi.listDocuments(contractId as string),
    enabled: typeof contractId === 'string',
    retry: false,
  });
  const templatesQuery = useQuery({
    queryKey: ['contract-templates'],
    queryFn: () => contractsApi.getTemplates(),
    enabled: creating,
  });

  const canCreate = hasPermission('contracts.create');
  const canUpdate = hasPermission('contracts.update');
  const canGenerate = hasPermission('contracts.generate');

  const invalidateContract = () => {
    void queryClient.invalidateQueries({ queryKey: ['contracts', 'by-period', periodId] });
    if (contractId) {
      void queryClient.invalidateQueries({ queryKey: ['contracts', contractId] });
      void queryClient.invalidateQueries({ queryKey: ['contracts', contractId, 'validation'] });
      void queryClient.invalidateQueries({ queryKey: ['contracts', contractId, 'documents'] });
    }
  };

  const createMutation = useMutation({
    mutationFn: (payload: CreateContractPayload) =>
      contractsApi.createContract(periodId, payload),
    onSuccess: () => {
      setServerError(null);
      setCreating(false);
      invalidateContract();
    },
    onError: (error: unknown) => {
      setServerError(getApiErrorMessage(error, 'No fue posible crear el contrato.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateContractPayload) =>
      contractsApi.updateContract(contractId as string, payload),
    onSuccess: () => {
      setServerError(null);
      setEditing(false);
      invalidateContract();
    },
    onError: (error: unknown) => {
      setServerError(getApiErrorMessage(error, 'No fue posible actualizar el contrato.'));
    },
  });

  const generateMutation = useMutation({
    mutationFn: (format: 'docx' | 'pdf') =>
      contractsApi.generateDocument(contractId as string, format),
    onSuccess: () => {
      setServerError(null);
      invalidateContract();
    },
    onError: (error: unknown) => {
      setServerError(getApiErrorMessage(error, 'No fue posible generar el documento.'));
    },
  });

  if (contractQuery.isLoading) return <p className="mt-4 text-slate-600">Cargando contrato...</p>;

  if (contractQuery.isError) {
    const status = getApiStatus(contractQuery.error);
    if (status !== 404) {
      return (
        <div
          role="alert"
          className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {status === 403
            ? 'Acceso denegado. No tiene permiso para ver contratos.'
            : 'No fue posible cargar el contrato.'}{' '}
          <button className="underline" onClick={() => contractQuery.refetch()}>
            Reintentar
          </button>
        </div>
      );
    }
    return (
      <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="font-semibold">Contrato</h2>
        <p className="mt-2 text-sm text-slate-600">No existe un contrato para este período.</p>
        {canCreate && !creating && (
          <button
            onClick={() => {
              setServerError(null);
              setCreating(true);
            }}
            className="mt-4 rounded bg-blue-900 px-4 py-2 text-sm text-white"
          >
            Crear contrato
          </button>
        )}
        {creating && (
          <ContractForm
            mode="create"
            schema={createContractSchema}
            defaultValues={{ templateId: '', currency: 'USD' }}
            templates={templatesQuery.data ?? []}
            templatesLoading={templatesQuery.isLoading}
            submitLabel="Crear contrato"
            isPending={createMutation.isPending}
            serverError={serverError}
            onCancel={() => {
              setCreating(false);
              setServerError(null);
            }}
            onSubmit={(payload) => createMutation.mutate(payload as CreateContractPayload)}
          />
        )}
      </article>
    );
  }

  const contract = contractQuery.data;
  const validation = validationQuery.data;
  const documents = documentsQuery.data ?? [];

  if (!contract) {
    return (
      <div
        role="alert"
        className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        No fue posible cargar el contrato.{' '}
        <button className="underline" onClick={() => contractQuery.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Contrato</h2>
        <span className="rounded bg-slate-100 px-3 py-1 text-sm">Estado: {contract.status}</span>
      </div>

      {serverError && (
        <p role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {serverError}
        </p>
      )}

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Plantilla</dt>
          <dd>
            {contract.template
              ? `${contract.template.name} (v${contract.template.version})`
              : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Número</dt>
          <dd>{contract.contractNumber ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Fecha de firma</dt>
          <dd>{toDateInput(contract.signingDate) || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Vigencia</dt>
          <dd>
            {toDateInput(contract.effectiveFrom) || '—'} →{' '}
            {toDateInput(contract.effectiveTo) || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Entrega de información</dt>
          <dd>{toDateInput(contract.informationDeliveryDate) || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Entrega borrador</dt>
          <dd>{toDateInput(contract.draftReportDueDate) || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Entrega informe final</dt>
          <dd>{toDateInput(contract.reportDeliveryDate) || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Entrega informe tributario</dt>
          <dd>{toDateInput(contract.taxReportDeliveryDate) || '—'}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Honorarios</dt>
          <dd>
            {contract.feeNet ? `${contract.feeNet} ${contract.currency}` : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Período</dt>
          <dd>
            {contract.auditPeriod
              ? `${contract.auditPeriod.label} (${contract.auditPeriod.fiscalYear})`
              : '—'}
          </dd>
        </div>
      </dl>

      {validationQuery.isLoading && (
        <p className="mt-4 text-sm text-slate-600">Validando variables...</p>
      )}
      {validation && !validation.valid && (
        <div role="alert" className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">El contrato no es válido para generar documentos.</p>
          <ul className="mt-2 list-disc pl-5">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}
      {validation && validation.valid && (
        <p role="status" className="mt-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          Contrato válido. Todas las variables semánticas están resueltas.
        </p>
      )}
      {validation && validation.warnings.length > 0 && (
        <div className="mt-4 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <ul className="list-disc pl-5">
            {validation.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-3">
        {canUpdate && !editing && (
          <button
            onClick={() => {
              setServerError(null);
              setEditing(true);
            }}
            className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700"
          >
            Editar
          </button>
        )}
        <Link
          to={`/contracts/${contract.id}/preview`}
          className="rounded border border-slate-300 px-4 py-2 text-sm text-blue-900 underline"
        >
          Vista previa
        </Link>
        {canGenerate && (
          <>
            <button
              disabled={!validation?.valid || generateMutation.isPending}
              onClick={() => generateMutation.mutate('docx')}
              title={!validation?.valid ? 'El contrato debe ser válido para generar' : undefined}
              className="rounded bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generando...' : 'Generar Word'}
            </button>
            <button
              disabled={!validation?.valid || generateMutation.isPending}
              onClick={() => generateMutation.mutate('pdf')}
              title={!validation?.valid ? 'El contrato debe ser válido para generar' : undefined}
              className="rounded bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {generateMutation.isPending ? 'Generando...' : 'Generar PDF'}
            </button>
          </>
        )}
      </div>

      {editing && (
        <ContractForm
          mode="edit"
          schema={updateContractSchema}
          defaultValues={{
            templateId: contract.templateId ?? '',
            contractNumber: contract.contractNumber ?? '',
            signingDate: toDateInput(contract.signingDate),
            effectiveFrom: toDateInput(contract.effectiveFrom),
            effectiveTo: toDateInput(contract.effectiveTo),
            reportDeliveryDate: toDateInput(contract.reportDeliveryDate),
            taxReportDeliveryDate: toDateInput(contract.taxReportDeliveryDate),
            informationDeliveryDate: toDateInput(contract.informationDeliveryDate),
            draftReportDueDate: toDateInput(contract.draftReportDueDate),
            feeNet: contract.feeNet ?? '',
            currency: contract.currency,
            notes: contract.notes ?? '',
            status: contract.status,
          }}
          templates={[]}
          templatesLoading={false}
          submitLabel="Guardar cambios"
          isPending={updateMutation.isPending}
          serverError={serverError}
          onCancel={() => {
            setEditing(false);
            setServerError(null);
          }}
          onSubmit={(payload) => {
            const { templateId: _templateId, ...rest } = payload as UpdateContractPayload & {
              templateId?: string;
            };
            void _templateId;
            updateMutation.mutate(rest);
          }}
        />
      )}

      {documents.length > 0 && (
        <section aria-label="Documentos generados" className="mt-6">
          <h3 className="font-semibold">Documentos generados</h3>
          {downloadError && (
            <p role="alert" className="mt-2 text-sm text-red-700">{downloadError}</p>
          )}
          <ul className="mt-3 grid gap-3">
            {documents.map((doc) => (
              <li
                key={doc.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border border-slate-200 p-3 text-sm"
              >
                <span>
                  <b>{doc.type === 'CONTRACT_PDF' ? 'PDF' : 'Word'}</b> · {doc.title} ·{' '}
                  {doc.status}
                </span>
                <button
                  disabled={downloadingId === doc.id}
                  onClick={() => {
                    setDownloadingId(doc.id);
                    setDownloadError(null);
                    contractsApi
                      .downloadDocument(contract.id, doc)
                      .catch(() => setDownloadError('No fue posible descargar el documento.'))
                      .finally(() => setDownloadingId(null));
                  }}
                  className="text-blue-900 underline disabled:opacity-50"
                >
                  {downloadingId === doc.id ? 'Descargando...' : 'Descargar'}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
