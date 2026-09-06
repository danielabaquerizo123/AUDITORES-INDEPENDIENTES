import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { cleanOptional, type ContractFormDefaults } from '../schemas/contract.schema';
import type {
  ContractTemplate,
  CreateContractPayload,
  UpdateContractPayload,
} from '../services/contracts.api';

export type ContractFormMode = 'create' | 'edit';

interface ContractFormProps<TSchema extends z.ZodTypeAny> {
  mode: ContractFormMode;
  schema: TSchema;
  defaultValues: ContractFormDefaults;
  templates: ContractTemplate[];
  templatesLoading: boolean;
  submitLabel: string;
  isPending: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (payload: CreateContractPayload | UpdateContractPayload) => void;
}

type FormValues = {
  templateId: string;
  contractNumber?: string;
  signingDate?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  reportDeliveryDate?: string;
  taxReportDeliveryDate?: string;
  informationDeliveryDate?: string;
  draftReportDueDate?: string;
  feeNet?: string;
  currency: string;
  notes?: string;
  status?: 'DRAFT' | 'ACTIVE' | 'APPROVED' | 'CANCELLED';
};

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 p-2 text-sm';
const labelClass = 'block text-sm font-medium text-slate-700';
const errorClass = 'mt-1 text-xs text-red-700';

export function ContractForm<TSchema extends z.ZodTypeAny>({
  mode,
  schema,
  defaultValues,
  templates,
  templatesLoading,
  submitLabel,
  isPending,
  serverError,
  onCancel,
  onSubmit,
}: ContractFormProps<TSchema>) {
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
    const base = {
      contractNumber: cleanOptional(values.contractNumber),
      signingDate: cleanOptional(values.signingDate),
      effectiveFrom: cleanOptional(values.effectiveFrom),
      effectiveTo: cleanOptional(values.effectiveTo),
      reportDeliveryDate: cleanOptional(values.reportDeliveryDate),
      taxReportDeliveryDate: cleanOptional(values.taxReportDeliveryDate),
      informationDeliveryDate: cleanOptional(values.informationDeliveryDate),
      draftReportDueDate: cleanOptional(values.draftReportDueDate),
      feeNet: cleanOptional(values.feeNet),
      currency: values.currency.trim().toUpperCase(),
      notes: cleanOptional(values.notes),
    };
    if (mode === 'create') {
      onSubmit({ templateId: values.templateId, ...base });
      return;
    }
    onSubmit({ ...base, status: values.status ?? 'DRAFT' });
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
        {mode === 'create' && (
          <label className={labelClass}>
            Plantilla *
            <select {...register('templateId')} className={inputClass}>
              <option value="">Seleccione una plantilla</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name} (v{template.version})
                </option>
              ))}
            </select>
            {errors.templateId && <span className={errorClass}>{errors.templateId.message}</span>}
          </label>
        )}
        <label className={labelClass}>
          Número de contrato
          <input {...register('contractNumber')} className={inputClass} />
          {errors.contractNumber && (
            <span className={errorClass}>{errors.contractNumber.message}</span>
          )}
        </label>
        <label className={labelClass}>
          Fecha de firma
          <input {...register('signingDate')} type="date" className={inputClass} />
          {errors.signingDate && <span className={errorClass}>{errors.signingDate.message}</span>}
        </label>
        <label className={labelClass}>
          Vigencia hasta
          <input {...register('effectiveTo')} type="date" className={inputClass} />
          {errors.effectiveTo && (
            <span className={errorClass}>{errors.effectiveTo.message}</span>
          )}
        </label>
        <label className={labelClass}>
          Entrega de información (cliente)
          <input {...register('informationDeliveryDate')} type="date" className={inputClass} />
          {errors.informationDeliveryDate && (
            <span className={errorClass}>{errors.informationDeliveryDate.message}</span>
          )}
        </label>
        <label className={labelClass}>
          Entrega borrador de informe
          <input {...register('draftReportDueDate')} type="date" className={inputClass} />
          {errors.draftReportDueDate && (
            <span className={errorClass}>{errors.draftReportDueDate.message}</span>
          )}
        </label>
        <label className={labelClass}>
          Entrega informe final
          <input {...register('reportDeliveryDate')} type="date" className={inputClass} />
          {errors.reportDeliveryDate && (
            <span className={errorClass}>{errors.reportDeliveryDate.message}</span>
          )}
        </label>
        <label className={labelClass}>
          Entrega informe tributario
          <input {...register('taxReportDeliveryDate')} type="date" className={inputClass} />
          {errors.taxReportDeliveryDate && (
            <span className={errorClass}>{errors.taxReportDeliveryDate.message}</span>
          )}
        </label>
        <label className={labelClass}>
          Vigencia hasta
          <input {...register('effectiveTo')} type="date" className={inputClass} />
          {errors.effectiveTo && <span className={errorClass}>{errors.effectiveTo.message}</span>}
        </label>
        <label className={labelClass}>
          Honorarios (valor neto)
          <input
            {...register('feeNet')}
            inputMode="decimal"
            placeholder="1500.00"
            className={inputClass}
          />
          {errors.feeNet && <span className={errorClass}>{errors.feeNet.message}</span>}
        </label>
        <label className={labelClass}>
          Moneda *
          <input {...register('currency')} className={inputClass} maxLength={3} placeholder="USD" />
          {errors.currency && <span className={errorClass}>{errors.currency.message}</span>}
        </label>
        {mode === 'edit' && (
          <label className={labelClass}>
            Estado *
            <select {...register('status')} className={inputClass}>
              <option value="DRAFT">Borrador</option>
              <option value="ACTIVE">Activo</option>
              <option value="APPROVED">Aprobado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
            {errors.status && <span className={errorClass}>{errors.status.message}</span>}
          </label>
        )}
        <label className={`${labelClass} sm:col-span-2`}>
          Observaciones
          <textarea {...register('notes')} rows={3} className={inputClass} />
          {errors.notes && <span className={errorClass}>{errors.notes.message}</span>}
        </label>
      </div>
      {mode === 'create' && !templatesLoading && templates.length === 0 && (
        <p className="mt-3 text-sm text-amber-700">
          No hay plantillas activas. Solicite a un administrador que registre una plantilla.
        </p>
      )}
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
