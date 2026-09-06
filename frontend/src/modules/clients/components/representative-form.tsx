import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { cleanOptional, type RepresentativeFormDefaults } from '../schemas/representative.schema';
import type {
  CreateRepresentativePayload,
  UpdateRepresentativePayload,
} from '../services/representatives.api';

interface RepresentativeFormProps<TSchema extends z.ZodTypeAny> {
  schema: TSchema;
  defaultValues: RepresentativeFormDefaults;
  submitLabel: string;
  isPending: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (payload: CreateRepresentativePayload | UpdateRepresentativePayload) => void;
}

type FormValues = {
  treatment: string;
  fullName: string;
  nationalId?: string;
  position?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
  validFrom?: string;
  validTo?: string;
};

const inputClass = 'mt-1 w-full rounded-md border border-slate-300 p-2 text-sm';
const labelClass = 'block text-sm font-medium text-slate-700';
const errorClass = 'mt-1 text-xs text-red-700';

export function RepresentativeForm<TSchema extends z.ZodTypeAny>({
  schema,
  defaultValues,
  submitLabel,
  isPending,
  serverError,
  onCancel,
  onSubmit,
}: RepresentativeFormProps<TSchema>) {
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
    onSubmit({
      treatment: values.treatment,
      fullName: values.fullName.trim(),
      nationalId: cleanOptional(values.nationalId),
      position: cleanOptional(values.position),
      email: cleanOptional(values.email),
      phone: cleanOptional(values.phone),
      isPrimary: values.isPrimary ?? false,
      validFrom: cleanOptional(values.validFrom),
      validTo: cleanOptional(values.validTo),
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
          Tratamiento *
          <select {...register('treatment')} className={inputClass}>
            <option value="Sr.">Sr.</option>
            <option value="Sra.">Sra.</option>
          </select>
          {errors.treatment && <span className={errorClass}>{errors.treatment.message}</span>}
        </label>
        <label className={labelClass}>
          Nombre completo *
          <input {...register('fullName')} className={inputClass} autoComplete="name" />
          {errors.fullName && <span className={errorClass}>{errors.fullName.message}</span>}
        </label>
        <label className={labelClass}>
          Identificación
          <input {...register('nationalId')} className={inputClass} />
          {errors.nationalId && <span className={errorClass}>{errors.nationalId.message}</span>}
        </label>
        <label className={labelClass}>
          Cargo
          <input {...register('position')} className={inputClass} />
          {errors.position && <span className={errorClass}>{errors.position.message}</span>}
        </label>
        <label className={labelClass}>
          Email
          <input {...register('email')} type="email" className={inputClass} autoComplete="email" />
          {errors.email && <span className={errorClass}>{errors.email.message}</span>}
        </label>
        <label className={labelClass}>
          Teléfono
          <input {...register('phone')} className={inputClass} autoComplete="tel" />
          {errors.phone && <span className={errorClass}>{errors.phone.message}</span>}
        </label>
        <label className={`${labelClass} flex items-center gap-2 pt-6`}>
          <input {...register('isPrimary')} type="checkbox" className="size-4" />
          Representante principal
        </label>
        <label className={labelClass}>
          Vigencia desde
          <input {...register('validFrom')} type="date" className={inputClass} />
          {errors.validFrom && <span className={errorClass}>{errors.validFrom.message}</span>}
        </label>
        <label className={labelClass}>
          Vigencia hasta
          <input {...register('validTo')} type="date" className={inputClass} />
          {errors.validTo && <span className={errorClass}>{errors.validTo.message}</span>}
        </label>
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
