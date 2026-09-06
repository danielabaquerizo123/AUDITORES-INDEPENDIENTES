import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../app/use-auth';
import { getApiErrorMessage, getApiStatus } from '../../clients/services/clients.api';
import {
  IMPORT_STATUS_LABELS,
  STATEMENT_LABELS,
  financialStatementsApi,
  formatAmount,
  formatFileSize,
  formatPercent,
  type FinancialStatementLine,
  type FinancialStatementType,
} from '../services/financial-statements.api';
import { LineClassificationDialog } from './line-classification-dialog';

const STATEMENT_TABS: FinancialStatementType[] = [
  'FINANCIAL_POSITION',
  'COMPREHENSIVE_INCOME',
  'CHANGES_IN_EQUITY',
  'CASH_FLOW',
];

type LineFilter = 'all' | 'unclassified' | 'manual';

interface FinancialSectionProps {
  periodId: string;
}

export function FinancialSection({ periodId }: FinancialSectionProps) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [processError, setProcessError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FinancialStatementType>('FINANCIAL_POSITION');
  const [lineFilter, setLineFilter] = useState<LineFilter>('all');
  const [reclassify, setReclassify] = useState<{
    line: FinancialStatementLine;
    type: FinancialStatementType;
  } | null>(null);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);

  const canRead = hasPermission('financial.read');
  const canImport = hasPermission('financial.import');
  const canUpdate = hasPermission('financial.update');

  const importsQuery = useQuery({
    queryKey: ['financial-imports', periodId],
    queryFn: () => financialStatementsApi.listImports(periodId),
    enabled: canRead,
    retry: false,
  });

  const detailQuery = useQuery({
    queryKey: ['financial-imports', selectedId],
    queryFn: () => financialStatementsApi.getImport(selectedId as string),
    enabled: canRead && typeof selectedId === 'string',
    retry: false,
  });

  const statementsQuery = useQuery({
    queryKey: ['financial-imports', selectedId, 'statements'],
    queryFn: () => financialStatementsApi.getStatements(selectedId as string),
    enabled: canRead && typeof selectedId === 'string',
    retry: false,
  });

  const catalogQuery = useQuery({
    queryKey: ['financial-statement-keys'],
    queryFn: () => financialStatementsApi.getCatalog(),
    enabled: canUpdate && reclassify !== null,
    retry: false,
  });

  const reclassifyMutation = useMutation({
    mutationFn: ({ lineId, key }: { lineId: string; key: string }) =>
      financialStatementsApi.reclassifyLine(lineId, key),
    onSuccess: () => {
      setReclassifyError(null);
      setReclassify(null);
      refresh(selectedId ?? undefined);
    },
    onError: (error: unknown) => {
      setReclassifyError(getApiErrorMessage(error, 'No fue posible guardar la clasificación.'));
    },
  });

  const refresh = (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ['financial-imports', periodId] });
    if (id) {
      void queryClient.invalidateQueries({ queryKey: ['financial-imports', id] });
      void queryClient.invalidateQueries({ queryKey: ['financial-imports', id, 'statements'] });
    }
  };

  const processMutation = useMutation({
    mutationFn: (id: string) => financialStatementsApi.processImport(id),
    onSuccess: (result) => {
      setProcessError(null);
      setSelectedId(result.id);
      refresh(result.id);
    },
    onError: (error: unknown) => {
      setProcessError(getApiErrorMessage(error, 'No fue posible procesar el archivo.'));
    },
  });

  const uploadMutation = useMutation({
    mutationFn: (payload: File) => financialStatementsApi.uploadImport(periodId, payload),
    onSuccess: (created) => {
      setUploadError(null);
      setFile(null);
      refresh(created.id);
      processMutation.mutate(created.id);
    },
    onError: (error: unknown) => {
      setUploadError(getApiErrorMessage(error, 'No fue posible cargar el archivo.'));
    },
  });

  if (!canRead) {
    return (
      <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
        <p role="alert" className="text-sm text-red-800">
          Acceso denegado. No tiene permiso para ver estados financieros.
        </p>
      </article>
    );
  }

  const imports = importsQuery.data ?? [];
  const detail = detailQuery.data;
  const statements = statementsQuery.data ?? [];
  const byType = new Map(statements.map((statement) => [statement.type, statement]));
  const busy = uploadMutation.isPending || processMutation.isPending;

  const pickFile = (candidate: File | null) => {
    setUploadError(null);
    setFile(candidate);
  };

  return (
    <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Estados Financieros</h2>
      </div>

      {canImport && (
        <section aria-label="Cargar estados financieros" className="mt-4">
          <div
            role="button"
            tabIndex={0}
            aria-label="Zona de carga de Excel"
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              pickFile(event.dataTransfer.files?.[0] ?? null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') event.preventDefault();
            }}
            className={`rounded-lg border-2 border-dashed p-6 text-center text-sm ${
              dragging ? 'border-blue-900 bg-blue-50' : 'border-slate-300 bg-slate-50'
            }`}
          >
            <p className="text-slate-700">Arrastre un Excel (.xlsx o .xls) o selecciónelo:</p>
            <input
              aria-label="Seleccionar archivo Excel"
              type="file"
              accept=".xlsx,.xls"
              className="mt-3 text-sm"
              onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
            />
          </div>

          {file && (
            <div className="mt-3 rounded border border-slate-200 p-3 text-sm">
              <p>
                <b>{file.name}</b> · {formatFileSize(file.size)} · {file.type || 'tipo no declarado'}
              </p>
              <button
                onClick={() => uploadMutation.mutate(file)}
                disabled={busy}
                className="mt-2 rounded bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {uploadMutation.isPending ? 'Subiendo...' : 'Cargar estados financieros'}
              </button>
            </div>
          )}

          {(uploadMutation.isPending || processMutation.isPending) && (
            <p role="status" className="mt-3 text-sm text-slate-600">
              {uploadMutation.isPending
                ? 'Subiendo archivo...'
                : 'Procesando: analizando archivo, detectando estados, normalizando y validando...'}
            </p>
          )}

          {uploadError && (
            <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {uploadError}
            </p>
          )}
          {processError && (
            <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {processError}
            </p>
          )}
        </section>
      )}

      <section aria-label="Archivos cargados" className="mt-6">
        <h3 className="font-semibold">Archivos cargados</h3>
        {importsQuery.isLoading && <p className="mt-2 text-sm text-slate-600">Cargando archivos...</p>}
        {importsQuery.isError && (
          <p role="alert" className="mt-2 text-sm text-red-700">
            {getApiStatus(importsQuery.error) === 403
              ? 'Acceso denegado.'
              : 'No fue posible cargar los archivos.'}{' '}
            <button className="underline" onClick={() => importsQuery.refetch()}>
              Reintentar
            </button>
          </p>
        )}
        {importsQuery.data && imports.length === 0 && (
          <p className="mt-2 text-sm text-slate-600">Aún no hay archivos cargados para este período.</p>
        )}
        {imports.length > 0 && (
          <ul className="mt-3 grid gap-2">
            {imports.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3 rounded border border-slate-200 p-3 text-sm"
              >
                <span className="font-medium">{item.originalFileName}</span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                  {IMPORT_STATUS_LABELS[item.status]}
                </span>
                <span className="text-slate-500">
                  {new Date(item.createdAt).toLocaleDateString('es-EC')} · v{item.version}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedId(item.id);
                      refresh(item.id);
                    }}
                    className="text-blue-900 underline"
                  >
                    Ver
                  </button>
                  {canImport && (
                    <button
                      onClick={() => processMutation.mutate(item.id)}
                      disabled={busy}
                      className="text-blue-900 underline disabled:opacity-50"
                    >
                      Procesar
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {detail && (
        <section aria-label="Resultado del procesamiento" className="mt-6">
          <h3 className="font-semibold">Resultado: {detail.originalFileName}</h3>
          <p className="mt-1 text-sm text-slate-600">
            Estado: {IMPORT_STATUS_LABELS[detail.status]} · Año actual:{' '}
            {detail.currentYear ?? '—'} · Año anterior: {detail.previousYear ?? '—'}
          </p>

          {detail.status === 'FAILED' && (
            <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              {detail.processingError ?? 'No fue posible procesar el archivo.'}
            </p>
          )}

          {detail.status === 'REVIEW_REQUIRED' && (
            <div role="alert" className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">Este archivo requiere revisión.</p>
              <ul className="mt-1 list-disc pl-5">
                {(() => {
                  const allLines = statements.flatMap((statement) => statement.lines);
                  const unclassified = allLines.filter((line) => !line.classified).length;
                  const issues = detail.validationIssues ?? [];
                  const numeric = issues.filter((issue) => issue.code === 'UNPARSEABLE_NUMBER').length;
                  const mismatches = issues.filter((issue) => issue.code === 'BALANCE_MISMATCH').length;
                  const others = issues.length - numeric - mismatches;
                  return (
                    <>
                      {unclassified > 0 && <li>Líneas sin clasificar: {unclassified}</li>}
                      {numeric > 0 && <li>Errores numéricos: {numeric}</li>}
                      {mismatches > 0 && <li>Descuadres contables: {mismatches}</li>}
                      {others > 0 && <li>Otras alertas: {others}</li>}
                      {unclassified === 0 && issues.length === 0 && <li>Sin detalle disponible.</li>}
                    </>
                  );
                })()}
              </ul>
            </div>
          )}

          {detail.validationIssues && detail.validationIssues.length > 0 && (
            <div role="alert" className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <p className="font-semibold">Alertas de validación:</p>
              <ul className="mt-1 list-disc pl-5">
                {detail.validationIssues.map((issue, index) => (
                  <li key={`${issue.code}-${index}`}>{issue.message}</li>
                ))}
              </ul>
            </div>
          )}

          {detail.detectionSummary && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {STATEMENT_TABS.map((type) => {
                const found = detail.detectionSummary?.find((entry) => entry.type === type);
                return (
                  <div key={type} className="rounded border border-slate-200 p-3 text-sm">
                    <p className="font-medium">{STATEMENT_LABELS[type]}</p>
                    {found ? (
                      <p className="text-slate-600">
                        Detectado · Hoja: {found.sheetName} · {found.lineCount} líneas ·{' '}
                        {found.unclassified} sin clasificar
                      </p>
                    ) : (
                      <p className="text-slate-500">No detectado</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {statements.length > 0 && (
            <div className="mt-4">
              <div className="flex flex-wrap items-center gap-2" aria-label="Filtro de líneas">
                <span className="text-sm text-slate-600">Mostrar:</span>
                {(
                  [
                    ['all', 'Todas'],
                    ['unclassified', 'Sin clasificar'],
                    ['manual', 'Clasificadas manualmente'],
                  ] as [LineFilter, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setLineFilter(value)}
                    aria-pressed={lineFilter === value}
                    className={`rounded-md px-3 py-1 text-sm ${
                      lineFilter === value
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div role="tablist" aria-label="Estados financieros" className="mt-3 flex flex-wrap gap-2">
                {STATEMENT_TABS.filter((type) => byType.has(type)).map((type) => (
                  <button
                    key={type}
                    role="tab"
                    aria-selected={activeTab === type}
                    onClick={() => setActiveTab(type)}
                    className={`rounded-md px-4 py-2 text-sm font-medium ${
                      activeTab === type
                        ? 'bg-slate-900 text-white'
                        : 'border border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {STATEMENT_LABELS[type]}
                  </button>
                ))}
              </div>

              {STATEMENT_TABS.filter((type) => byType.has(type)).map(
                (type) =>
                  activeTab === type && (
                    <div key={type} role="tabpanel" className="mt-3 overflow-x-auto">
                      <table className="w-full min-w-[640px] border-collapse text-sm">
                        <thead>
                          <tr className="bg-slate-100 text-left">
                            <th className="border border-slate-200 p-2">Cuenta</th>
                            <th className="border border-slate-200 p-2 text-right">Año actual</th>
                            <th className="border border-slate-200 p-2 text-right">Año anterior</th>
                            <th className="border border-slate-200 p-2 text-right">Diferencia</th>
                            <th className="border border-slate-200 p-2 text-right">%</th>
                            {canUpdate && <th className="border border-slate-200 p-2">Clasificación</th>}
                          </tr>
                        </thead>
                        <tbody>
                          {(byType.get(type)?.lines ?? [])
                            .filter((line) => {
                              if (lineFilter === 'unclassified') return !line.classified;
                              if (lineFilter === 'manual') return line.classificationSource === 'MANUAL';
                              return true;
                            })
                            .map((line) => (
                            <tr key={line.id}>
                              <td className="border border-slate-200 p-2">
                                {line.rawLabel}
                                {!line.classified && (
                                  <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                                    Requiere revisión
                                  </span>
                                )}
                                {line.classificationSource === 'MANUAL' && (
                                  <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                                    Manual
                                  </span>
                                )}
                              </td>
                              <td className="border border-slate-200 p-2 text-right">
                                {formatAmount(line.currentValue)}
                              </td>
                              <td className="border border-slate-200 p-2 text-right">
                                {formatAmount(line.previousValue)}
                              </td>
                              <td className="border border-slate-200 p-2 text-right">
                                {formatAmount(line.difference)}
                              </td>
                              <td className="border border-slate-200 p-2 text-right">
                                {formatPercent(line.percentageChange)}
                              </td>
                              {canUpdate && (
                                <td className="border border-slate-200 p-2">
                                  <button
                                    onClick={() => {
                                      setReclassifyError(null);
                                      setReclassify({ line, type });
                                    }}
                                    className="text-blue-900 underline"
                                  >
                                    {line.classified ? 'Reclasificar' : 'Clasificar'}
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ),
              )}
            </div>
          )}

          {reclassify && (
            <LineClassificationDialog
              line={reclassify.line}
              statementType={reclassify.type}
              compatibleKeys={catalogQuery.data?.[reclassify.type] ?? []}
              catalogLoading={catalogQuery.isLoading}
              isPending={reclassifyMutation.isPending}
              serverError={reclassifyError}
              onSave={(key) =>
                reclassifyMutation.mutate({ lineId: reclassify.line.id, key })
              }
              onCancel={() => {
                setReclassify(null);
                setReclassifyError(null);
              }}
            />
          )}
        </section>
      )}
    </article>
  );
}
