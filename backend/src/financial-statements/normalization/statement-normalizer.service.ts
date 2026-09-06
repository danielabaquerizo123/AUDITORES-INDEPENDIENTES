import { Injectable } from '@nestjs/common';
import { FinancialStatementType } from '@prisma/client';
import { plainText } from './text.utils';

interface KeyRule {
  key: string;
  patterns: RegExp[];
  priority: number;
}

function rule(key: string, priority: number, ...patterns: string[]): KeyRule {
  return { key, priority, patterns: patterns.map((source) => new RegExp(source)) };
}

// Diccionario genérico español (+ alias ingleses mínimos). Las reglas se
// evalúan por prioridad: totales y conceptos específicos antes que genéricos.
// Ninguna regla depende de un cliente, hoja o año concreto.
const RULES: Record<FinancialStatementType, KeyRule[]> = {
  FINANCIAL_POSITION: [
    rule('financial_position.total_assets', 100, 'total\\s+(de\\s+|del\\s+)?activ(?!.*corriente)', 'activ(os?)?\\s+totales?'),
    rule('financial_position.total_liabilities_and_equity', 95, 'total\\s+(de\\s+)?(pasivo.*patrimonio|patrimonio.*pasivo)', 'total\\s+pasivo\\s+y\\s+patrimonio'),
    rule('financial_position.total_liabilities', 90, 'total\\s+(de\\s+|del\\s+)?pasiv(?!.*corriente)', 'pasiv(os?)?\\s+totales?'),
    rule('financial_position.total_equity', 90, 'total\\s+(de\\s+|del\\s+)?patrimonio', 'total\\s+capital\\s+contable', 'patrimonio\\s+(total|neto)'),
    rule('financial_position.total_equity', 90, 'total\\s+(de\\s+|del\\s+)?patrimonio', 'total\\s+capital\\s+contable'),
    rule('financial_position.current_assets', 80, 'activ.*corriente', 'current\\s+assets?'),
    rule('financial_position.non_current_assets', 80, 'activ.*no\\s+corriente', 'non.?current\\s+assets?'),
    rule('financial_position.property_plant_equipment', 75, 'propiedad.*planta.*equipo|propiedades.*planta|activ.*fij|inmovilizado.*material|property.*plant.*equipment'),
    rule('financial_position.cash_and_equivalents', 70, 'efectivo.*equivalente', 'caja.*bancos?', 'cash'),
    rule('financial_position.receivables', 70, 'cuentas.*cobrar|clientes|deudores|receivables?'),
    rule('financial_position.inventories', 70, 'inventarios?|existencias|mercaderia|inventory|inventories'),
    rule('financial_position.current_liabilities', 80, 'pasiv.*corriente', 'current\\s+liabilit'),
    rule('financial_position.non_current_liabilities', 80, 'pasiv.*no\\s+corriente', 'non.?current\\s+liabilit'),
    rule('financial_position.total_assets', 60, '^activ(os?)?$', 'assets?'),
    rule('financial_position.total_liabilities', 60, '^pasiv(os?)?$', 'liabilit'),
    rule('financial_position.total_equity', 60, '^patrimonio(\\s+neto)?$', '^equity$', 'capital\\s+contable'),
  ],
  COMPREHENSIVE_INCOME: [
    rule('comprehensive_income.total_comprehensive_income', 100, 'resultado\\s+integral.*total|total.*resultado\\s+integral'),
    rule('comprehensive_income.net_profit', 95, 'utilidad\\s+neta|perdida\\s+neta|resultado\\s+neto|utilidad\\s+del\\s+(ejercicio|periodo|ano)|net\\s+(profit|income|loss)'),
    rule('comprehensive_income.gross_profit', 90, 'utilidad\\s+bruta|perdida\\s+bruta|margen\\s+bruto|gross\\s+profit'),
    rule('comprehensive_income.operating_profit', 90, 'utilidad\\s+(de\\s+)?operaci|resultado\\s+operativo|operating\\s+(profit|income)'),
    rule('comprehensive_income.profit_before_tax', 90, 'antes\\s+de\\s+(impuestos|isr)|profit\\s+before\\s+tax'),
    rule('comprehensive_income.revenue', 80, 'total\\s+de\\s+ingresos?', '(?<!costo\\s+de\\s+)ventas(\\s+netas?)?', 'ingresos?(?!\\s+financieros?)(\\s+(operacionales|ordinarios|por\\s+ventas|totales|de\\s+actividades\\s+ordinarias))?$', '\\brevenue\\b', '\\bsales\\b'),
    rule('comprehensive_income.cost_of_sales', 85, 'costo\\s+de\\s+(ventas|lo\\s+vendido)|cost\\s+of\\s+(sales|goods)'),
    rule('comprehensive_income.operating_expenses', 80, 'gastos?.*(operativos|de\\s+operaci|administraci|ventas)|operating\\s+expenses?'),
    rule('comprehensive_income.financial_income', 70, 'ingresos?\\s+financieros?|financial\\s+income'),
    rule('comprehensive_income.financial_expenses', 70, 'gastos?\\s+financieros?|financial\\s+(expenses?|costs?)'),
    rule('comprehensive_income.income_tax', 70, 'impuesto.*(renta|utilidades)|income\\s+tax'),
    rule('comprehensive_income.other_comprehensive_income', 70, 'otro\\s+resultado\\s+integral|other\\s+comprehensive'),
  ],
  CHANGES_IN_EQUITY: [
    rule('changes_in_equity.opening_balance', 95, 'saldo\\s+(inicial|al\\s+inicio)|balance\\s+inicial|opening\\s+balance'),
    rule('changes_in_equity.closing_balance', 95, 'saldo\\s+final|balance\\s+final|closing\\s+balance'),
    rule('changes_in_equity.net_profit', 90, 'utilidad\\s+neta|resultado\\s+(neto|del\\s+ejercicio)|net\\s+(profit|income)'),
    rule('changes_in_equity.dividends', 85, 'dividendos?|dividends?'),
    rule('changes_in_equity.contributions', 85, 'aportes?(\\s+de\\s+capital)?|aumentos?\\s+de\\s+capital|contributions?'),
    rule('changes_in_equity.other_movements', 70, 'otros?\\s+movimientos?|other\\s+movements?'),
    rule('changes_in_equity.retained_earnings', 60, 'utilidades?\\s+retenidas?|resultados?\\s+acumulados?|retained\\s+earnings'),
    rule('changes_in_equity.total_equity', 60, 'total\\s+(de\\s+)?patrimonio|total\\s+equity'),
  ],
  CASH_FLOW: [
    rule('cash_flow.operating_activities', 95, 'actividades?\\s+de\\s+operaci|operating\\s+activities?'),
    rule('cash_flow.investing_activities', 95, 'actividades?\\s+de\\s+inversi|investing\\s+activities?'),
    rule('cash_flow.financing_activities', 95, 'actividades?\\s+de\\s+financia|financing\\s+activities?'),
    rule('cash_flow.net_change', 90, '(aumento|disminucion|variacion)\\s+neta.*efectivo|net\\s+(increase|decrease).*cash'),
    rule('cash_flow.opening_cash', 85, 'efectivo\\s+al\\s+(inicio|comienzo)|cash.*beginning'),
    rule('cash_flow.closing_cash', 85, 'efectivo\\s+al\\s+final|cash.*end'),
    rule('cash_flow.total_cash_flow', 60, 'flujo\\s+(neto\\s+de\\s+)?efectivo|cash\\s+flow'),
  ],
};

/**
 * Catálogo central de claves canónicas admitidas, derivado del mismo
 * diccionario de normalización. No se acepta texto libre como normalizedKey
 * y cada clave pertenece a un único estado (incompatibles => 400).
 */
export const CANONICAL_KEYS: Record<FinancialStatementType, string[]> = Object.fromEntries(
  (Object.keys(RULES) as FinancialStatementType[]).map((type) => [
    type,
    [...new Set(RULES[type].map((rule) => rule.key))],
  ]),
) as Record<FinancialStatementType, string[]>;

export function keyStatementType(key: string): FinancialStatementType | null {
  for (const type of Object.keys(CANONICAL_KEYS) as FinancialStatementType[]) {
    if (CANONICAL_KEYS[type].includes(key)) return type;
  }
  return null;
}

const TOTAL_LIKE = /total|subtotal|suma/i;

/**
 * Normaliza etiquetas crudas a claves canónicas. Si no hay coincidencia
 * segura devuelve null: la línea queda no clasificada para revisión,
 * nunca se le asigna una clasificación arbitraria.
 */
@Injectable()
export class StatementNormalizerService {
  normalize(type: FinancialStatementType, rawLabel: string): string | null {
    const text = plainText(rawLabel);
    if (!text) return null;
    const ordered = [...(RULES[type] ?? [])].sort((a, b) => b.priority - a.priority);
    for (const candidate of ordered) {
      if (candidate.patterns.some((pattern) => pattern.test(text))) return candidate.key;
    }
    return null;
  }

  isTotalLike(rawLabel: string): boolean {
    return TOTAL_LIKE.test(plainText(rawLabel));
  }
}
