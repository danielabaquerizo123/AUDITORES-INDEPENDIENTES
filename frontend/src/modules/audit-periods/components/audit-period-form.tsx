import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import type {
  CreateAuditPeriodPayload,
  UpdateAuditPeriodPayload,
} from '../services/audit-periods.api';
import type { AuditPeriodFormDefaults } from '../schemas/audit-period.schema';

export type AuditPeriodFormMode = 'create' | 'edit';

interface AuditPeriodFormProps<TSchema extends z.ZodTypeAny> {
  mode: AuditPeriodFormMode;
  schema: TSchema;
  defaultValues: AuditPeriodFormDefaults;
  submitLabel: string;
  isPending: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (payload: CreateAuditPeriodPayload | UpdateAuditPeriodPayload) => void;
}

type FormValues = {
  label: string;
  fiscalYear: number | string;
  startDate: string;
  endDate: string;
  status?: 'OPEN' | 'LOCKED' | 'CLOSED';
};

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 p-2 text-sm';
const labelClass = 'block text-sm font-medium text-slate-700';
const errorClass = 'mt-1 text-xs text-red-700';

export function AuditPeriodForm<TSchema extends z.ZodTypeAny>({
  mode,
  schema,
  defaultValues,
  submitLabel,
  isPending,
  serverError,
  onCancel,
  onSubmit,
}: AuditPeriodFormProps<TSchema>) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema as any),
    defaultValues,
  });

  const submit = (values: FormValues) => {
    if (mode === 'create') {
      onSubmit({
        label: values.label.trim(),
        fiscalYear: Number(values.fiscalYear),
        startDate: values.startDate,
        endDate: values.endDate,
      });
      return;
    }
    onSubmit({
      label: values.label.trim(),
      startDate: values.startDate,
      endDate: values.endDate,
      status: values.status ?? 'OPEN',
    });
  };

  return (
    <form
      onSubmit={handleSubmit(submit)}
      className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4"
      noValidate
    >
      {serverError && (
        <p
          role="alert"
          className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {serverError}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClass}>
          Etiqueta *
          <input
            {...register('label')}
            className={inputClass}
            placeholder="Auditoría 2025"
          />
          {errors.label && <span className={errorClass}>{errors.label.message}</span>}
        </label>
        <label className={labelClass}>
          Año fiscal *
          <input
            {...register('fiscalYear')}
            type="number"
            className={inputClass}
            disabled={mode === 'edit'}
            title={mode === 'edit' ? 'El año fiscal no se puede modificar' : undefined}
          />
          {errors.fiscalYear && (
            <span className={errorClass}>{errors.fiscalYear.message}</span>
          )}
        </label>
        <label className={labelClass}>
          Fecha de inicio *
          <input {...register('startDate')} type="date" className={inputClass} />
          {errors.startDate && <span className={errorClass}>{errors.startDate.message}</span>}
        </label>
        <label className={labelClass}>
          Fecha de fin *
          <input {...register('endDate')} type="date" className={inputClass} />
          {errors.endDate && <span className={errorClass}>{errors.endDate.message}</span>}
        </label>
        {mode === 'edit' && (
          <label className={labelClass}>
            Estado *
            <select {...register('status')} className={inputClass}>
              <option value="OPEN">Abierto</option>
              <option value="LOCKED">Bloqueado</option>
              <option value="CLOSED">Cerrado</option>
            </select>
            {errors.status && <span className={errorClass}>{errors.status.message}</span>}
          </label>
        )}
      </div>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-blue-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {isPending ? 'Guardando...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm text-slate-700"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
