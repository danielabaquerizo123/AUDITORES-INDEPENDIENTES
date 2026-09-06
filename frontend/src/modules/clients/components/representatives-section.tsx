import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../../app/use-auth';
import { getApiErrorMessage, getApiStatus } from '../services/clients.api';
import {
  representativesApi,
  type CreateRepresentativePayload,
  type Representative,
  type UpdateRepresentativePayload,
} from '../services/representatives.api';
import {
  createRepresentativeSchema,
  representativeToDefaults,
  toDateInput,
  updateRepresentativeSchema,
} from '../schemas/representative.schema';
import { RepresentativeForm } from './representative-form';

export function RepresentativesSection({ clientId }: { clientId: string }) {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['clients', clientId, 'representatives'],
    queryFn: () => representativesApi.getRepresentatives(clientId),
  });

  const canWrite = hasPermission('clients.update');
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['clients', clientId, 'representatives'] });

  const createMutation = useMutation({
    mutationFn: (payload: CreateRepresentativePayload) =>
      representativesApi.createRepresentative(clientId, payload),
    onSuccess: () => {
      setServerError(null);
      setCreating(false);
      void invalidate();
    },
    onError: (error: unknown) => {
      setServerError(getApiErrorMessage(error, 'No fue posible crear el representante.'));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateRepresentativePayload }) =>
      representativesApi.updateRepresentative(clientId, id, payload),
    onSuccess: () => {
      setServerError(null);
      setEditingId(null);
      void invalidate();
    },
    onError: (error: unknown) => {
      setServerError(getApiErrorMessage(error, 'No fue posible actualizar el representante.'));
    },
  });

  if (query.isLoading) return <p className="mt-4 text-slate-600">Cargando representantes...</p>;

  if (query.isError) {
    const status = getApiStatus(query.error);
    return (
      <div
        role="alert"
        className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800"
      >
        {status === 403
          ? 'Acceso denegado. No tiene permiso para ver representantes.'
          : 'No fue posible cargar representantes.'}{' '}
        <button className="underline" onClick={() => query.refetch()}>
          Reintentar
        </button>
      </div>
    );
  }

  const items = query.data ?? [];
  const editing: Representative | undefined = items.find((item) => item.id === editingId);

  return (
    <article className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Representantes</h2>
        {canWrite && !creating && (
          <button
            onClick={() => {
              setServerError(null);
              setEditingId(null);
              setCreating(true);
            }}
            className="rounded bg-blue-900 px-4 py-2 text-sm text-white"
          >
            Nuevo representante
          </button>
        )}
      </div>

      {creating && (
        <RepresentativeForm
          schema={createRepresentativeSchema}
          defaultValues={{ treatment: 'Sr.', fullName: '', isPrimary: false }}
          submitLabel="Crear representante"
          isPending={createMutation.isPending}
          serverError={serverError}
          onCancel={() => {
            setCreating(false);
            setServerError(null);
          }}
          onSubmit={(payload) =>
            createMutation.mutate(payload as CreateRepresentativePayload)
          }
        />
      )}

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">No hay representantes registrados.</p>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded border border-slate-200 md:block">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="p-3">Tratamiento</th>
                  <th className="p-3">Nombre</th>
                  <th className="p-3">Identificación</th>
                  <th className="p-3">Cargo</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Teléfono</th>
                  <th className="p-3">Principal</th>
                  {canWrite && <th className="p-3">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr className="border-b last:border-0" key={item.id}>
                    <td className="p-3">{item.treatment ?? '—'}</td>
                    <td className="p-3 font-medium">{item.fullName}</td>
                    <td className="p-3">{item.nationalId ?? '—'}</td>
                    <td className="p-3">{item.position ?? '—'}</td>
                    <td className="p-3">{item.email ?? '—'}</td>
                    <td className="p-3">{item.phone ?? '—'}</td>
                    <td className="p-3">{item.isPrimary ? 'Sí' : '—'}</td>
                    {canWrite && (
                      <td className="p-3">
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
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 grid gap-4 md:hidden">
            {items.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <p className="font-semibold">
                  {item.fullName}
                  {item.isPrimary && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                      Principal
                    </span>
                  )}
                </p>
                {item.position && <p className="mt-1 text-sm text-slate-600">{item.position}</p>}
                {(item.email || item.phone) && (
                  <p className="mt-1 text-sm text-slate-600">
                    {[item.email, item.phone].filter(Boolean).join(' · ')}
                  </p>
                )}
                {(item.validFrom || item.validTo) && (
                  <p className="mt-1 text-sm text-slate-600">
                    Vigencia: {toDateInput(item.validFrom) || '—'} →{' '}
                    {toDateInput(item.validTo) || '—'}
                  </p>
                )}
                {canWrite && (
                  <button
                    className="mt-3 text-sm text-blue-900 underline"
                    onClick={() => {
                      setServerError(null);
                      setCreating(false);
                      setEditingId(item.id);
                    }}
                  >
                    Editar
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <RepresentativeForm
          key={editing.id}
          schema={updateRepresentativeSchema}
          defaultValues={representativeToDefaults(editing)}
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
              payload: payload as UpdateRepresentativePayload,
            })
          }
        />
      )}
    </article>
  );
}
