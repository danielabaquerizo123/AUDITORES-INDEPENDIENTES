import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../app/use-auth';
import { getApiErrorMessage, getApiStatus } from '../services/clients.api';
import {
  auditPeriodsApi,
  type AuditPeriod,
  type CreateAuditPeriodPayload,
  type UpdateAuditPeriodPayload,
} from '../../audit-periods/services/audit-periods.api';
import {
  auditPeriodToDefaults,
  createAuditPeriodSchema,
  toDateInput,
  updateAuditPeriodSchema,
} from '../../audit-periods/schemas/audit-period.schema';
import { AuditPeriodForm } from '../../audit-periods/components/audit-period-form';

export function PeriodsSection({ clientId }: { clientId: string }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['clients', clientId, 'audit-periods'],
    queryFn: () => auditPeriodsApi.getAuditPeriods(clientId),
  });

  const canCreate = hasPermission('periods.create');
  const canUpdate = hasPermission('periods.update');
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['clients', clientId, 'audit-periods'] });

  const createMutation = useMutation({
    mutationFn: (payload: CreateAuditPeriodPayload) =>
      auditPeriodsApi.createAuditPeriod(clientId, payload),
    onSuccess: () => {
      setServerError(null);
      setCreating(false);
      void invalidate();
    },
    onError: (error: unknown) => {
      setServerError(getApiErrorMessage(error, 'No fue posible crear el período.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateAuditPeriodPayload }) =>
      auditPeriodsApi.updateAuditPeriod(id, payload),
    onSuccess: () => {
      setServerError(null);
      setEditingId(null);
      void invalidate();
    },
    onError: (error: unknown) => {
      setServerError(getApiErrorMessage(error, 'No fue posible actualizar el período.'));
    },
  });

  const periods = useMemo(
    () => [...(query.data ?? [])].sort((a, b) => b.fiscalYear - a.fiscalYear),
    [query.data],
  );

  if (query.isLoading) return <p className="mt-4 text-slate-600">Cargando períodos...</p>;

  if (query.isError) {
    const status = getApiStatus(query.error);
    return (
      <div
        role="alert"
        className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        {status === 403
          ? 'Acceso denegado. No tiene permiso para ver períodos.'
          : 'No fue posible cargar períodos.'}{' '}
        <button className="underline" onClick={() => query.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  const editing: AuditPeriod | undefined = periods.find((item) => item.id === editingId);

  return (
    <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Períodos de auditoría</h2>
        {canCreate && !creating && (
          <button
            onClick={() => {
              setServerError(null);
              setEditingId(null);
              setCreating(true);
            }}
            className="rounded bg-blue-900 px-4 py-2 text-sm text-white"
          >
            Nuevo período
          </button>
        )}
      </div>

      {creating && (
        <AuditPeriodForm
          mode="create"
          schema={createAuditPeriodSchema}
          defaultValues={{ label: '', fiscalYear: '', startDate: '', endDate: '' }}
          submitLabel="Crear período"
          isPending={createMutation.isPending}
          serverError={serverError}
          onCancel={() => {
            setCreating(false);
            setServerError(null);
          }}
          onSubmit={(payload) =>
            createMutation.mutate(payload as CreateAuditPeriodPayload)
          }
        />
      )}

      {periods.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No hay períodos registrados.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded border border-slate-200 md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Año</th>
                  <th className="p-3">Etiqueta</th>
                  <th className="p-3">Inicio</th>
                  <th className="p-3">Fin</th>
                  <th className="p-3">Estado</th>
                  <th className="p-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((item) => (
                  <tr className="border-b last:border-0" key={item.id}>
                    <td className="p-3 font-medium">{item.fiscalYear}</td>
                    <td className="p-3">{item.label}</td>
                    <td className="p-3">{toDateInput(item.startDate)}</td>
                    <td className="p-3">{toDateInput(item.endDate)}</td>
                    <td className="p-3">{item.status}</td>
                    <td className="p-3">
                      <span className="flex gap-3">
                        <Link
                          className="text-blue-900 underline"
                          to={`/clients/${clientId}/audit-periods/${item.id}`}
                        >
                          Ver
                        </Link>
                        {canUpdate && (
                          <button
                            className="text-blue-900 underline"
                            onClick={() => {
                              setServerError(null);
                              setCreating(false);
                              setEditingId(item.id);
                            }}
                          >
                            Editar
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 grid gap-4 md:hidden">
            {periods.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <Link
                  className="font-semibold text-blue-900 underline"
                  to={`/clients/${clientId}/audit-periods/${item.id}`}
                >
                  Auditoría {item.fiscalYear}
                </Link>
                <p className="mt-1 text-sm text-slate-600">{item.label}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {toDateInput(item.startDate)} → {toDateInput(item.endDate)}
                </p>
                <p className="mt-1 text-sm text-slate-600">Estado: {item.status}</p>
                <p className="mt-3 flex gap-4 text-sm">
                  <Link
                    className="text-blue-900 underline"
                    to={`/clients/${clientId}/audit-periods/${item.id}`}
                  >
                    Ver
                  </Link>
                  {canUpdate && (
                    <button
                      className="text-blue-900 underline"
                      onClick={() => {
                        setServerError(null);
                        setCreating(false);
                        setEditingId(item.id);
                      }}
                    >
                      Editar
                    </button>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <AuditPeriodForm
          key={editing.id}
          mode="edit"
          schema={updateAuditPeriodSchema}
          defaultValues={auditPeriodToDefaults(editing)}
          submitLabel="Guardar cambios"
          isPending={updateMutation.isPending}
          serverError={serverError}
          onCancel={() => {
            setEditingId(null);
            setServerError(null);
          }}
          onSubmit={(payload) =>
            updateMutation.mutate({
              id: editing.id,
              payload: payload as UpdateAuditPeriodPayload,
            })
          }
        />
      )}
    </article>
  );
}
