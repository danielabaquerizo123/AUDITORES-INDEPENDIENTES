import { useState } from 'react';
import {
  STATEMENT_LABELS,
  formatAmount,
  type FinancialStatementLine,
  type FinancialStatementType,
} from '../services/financial-statements.api';

interface LineClassificationDialogProps {
  line: FinancialStatementLine;
  statementType: FinancialStatementType;
  compatibleKeys: string[];
  catalogLoading: boolean;
  isPending: boolean;
  serverError: string | null;
  onSave: (normalizedKey: string) => void;
  onCancel: () => void;
}

export function LineClassificationDialog({
  line,
  statementType,
  compatibleKeys,
  catalogLoading,
  isPending,
  serverError,
  onSave,
  onCancel,
}: LineClassificationDialogProps) {
  const [selected, setSelected] = useState(line.normalizedKey ?? '');

  return (
    <div role="dialog" aria-label={`Clasificar ${line.rawLabel}`} className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p className="text-sm font-medium">{STATEMENT_LABELS[statementType]}</p>
      <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-slate-500">Etiqueta original</dt>
          <dd className="font-medium">{line.rawLabel}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Valores (actual / anterior)</dt>
          <dd>
            {formatAmount(line.currentValue)} / {formatAmount(line.previousValue)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Clave actual</dt>
          <dd>{line.normalizedKey ?? '—'}</dd>
        </div>
      </dl>

      <label className="mt-3 block text-sm font-medium text-slate-700">
        Clave canónica
        <select
          aria-label="Clave canónica"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={catalogLoading}
          className="mt-1 w-full rounded-md border border-slate-300 bg-white p-2 text-sm"
        >
          <option value="">Seleccione una clave</option>
          {compatibleKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </label>
      {catalogLoading && <p className="mt-2 text-sm text-slate-600">Cargando catálogo...</p>}

      {serverError && (
        <p role="alert" className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">
          {serverError}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => selected && onSave(selected)}
          disabled={!selected || isPending}
          className="rounded bg-blue-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {isPending ? 'Guardando...' : 'Guardar'}
        </button>
        <button
          onClick={onCancel}
          className="rounded border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
