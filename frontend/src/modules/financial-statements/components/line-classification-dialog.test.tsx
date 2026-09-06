import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LineClassificationDialog } from './line-classification-dialog';

describe('LineClassificationDialog aislado', () => {
  it('llama onSave con la clave inicial de una línea clasificada', () => {
    const onSave = vi.fn();
    render(
      <LineClassificationDialog
        line={{
          id: 'l1',
          sortOrder: 1,
          rawLabel: 'TOTAL DE ACTIVOS',
          normalizedKey: 'financial_position.total_assets',
          classified: true,
          classificationSource: 'AUTO',
          sheetName: 'S',
          sourceRow: 5,
          currentValue: '5000',
          previousValue: '4800',
          difference: '200',
          percentageChange: '4.1667',
        }}
        statementType="FINANCIAL_POSITION"
        compatibleKeys={['financial_position.total_assets', 'financial_position.cash_and_equivalents']}
        catalogLoading={false}
        isPending={false}
        serverError={null}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).toHaveBeenCalledWith('financial_position.total_assets');
  });
});
