import { Injectable } from '@nestjs/common';
import { Contract, Client, ClientRepresentative, AuditPeriod, Organization } from '@prisma/client';
import { AmountToWordsService } from './amount-to-words.service';

export type ContractContextResult = {
  valid: boolean;
  missing: string[];
  context: Record<string, unknown>;
};

function feeWordsFor(
  words: AmountToWordsService,
  feeNet: unknown,
  currency: string,
): string | undefined {
  if (feeNet === null || feeNet === undefined) return undefined;
  const raw = typeof feeNet === 'string' ? feeNet : String(feeNet);
  if (raw.trim() === '') return undefined;
  try {
    return words.convert(raw, currency);
  } catch {
    return undefined;
  }
}

/**
 * Variables semánticas finales (Fase 4):
 * - contract.signingDate / contract.startDate (= effectiveFrom) / contract.endDate (= effectiveTo)
 * - contract.informationDeliveryDate / contract.draftReportDueDate
 * - contract.finalReportDueDate (alias de report.deliveryDate, sin columna propia)
 * - audit.periodStart / audit.periodEnd (desde el período persistido)
 * - report.deliveryDate (desde Contract.reportDeliveryDate)
 * - taxReport.deliveryDate (desde Contract.taxReportDeliveryDate)
 * - taxReportDeliveryDate (ALIAS LEGACY a nivel raíz para plantillas históricas
 *   que usaban {{taxReportDeliveryDate}}; equivale a taxReport.deliveryDate)
 *
 * Todas las fechas salen del contrato/periodo persistido en DB. Prohibido
 * inyectar fechas desde el formulario directamente al renderer.
 */
@Injectable()
export class ContractContextBuilder {
  constructor(private readonly words: AmountToWordsService = new AmountToWordsService()) {}

  build(input: {
    contract: Contract;
    client: Client;
    representative: ClientRepresentative | null;
    period: AuditPeriod;
    organization: Organization;
  }): ContractContextResult {
    const { contract, client, representative, period, organization } = input;
    const context = {
      company: {
        legalName: client.legalName,
        taxId: client.taxId,
        mainActivity: client.economicActivity,
        email: client.email,
        // Alias históricos conservados para plantillas/tests existentes.
        ruc: client.taxId,
        address: client.address,
      },
      representative: {
        treatment: representative?.treatment,
        fullName: representative?.fullName,
        identification: representative?.nationalId,
        position: representative?.position,
        // Alias histórico conservado para plantillas/tests existentes.
        name: representative?.fullName,
      },
      audit: {
        year: period.fiscalYear,
        label: period.label,
        periodStart: period.startDate,
        periodEnd: period.endDate,
      },
      contract: {
        number: contract.contractNumber,
        signingDate: contract.signingDate ?? undefined,
        startDate: contract.effectiveFrom ?? undefined,
        endDate: contract.effectiveTo ?? undefined,
        informationDeliveryDate: contract.informationDeliveryDate ?? undefined,
        draftReportDueDate: contract.draftReportDueDate ?? undefined,
        finalReportDueDate: contract.reportDeliveryDate ?? undefined,
        fee: contract.feeNet?.toString(),
        feeWords: feeWordsFor(this.words, contract.feeNet?.toString(), contract.currency),
        currency: contract.currency,
      },
      auditor: {
        name: organization.auditorName ?? organization.legalName ?? organization.name,
        ruc: organization.taxId,
        registration: organization.auditorRegistration,
        email: organization.email,
      },
      organization: {
        name: organization.name,
        legalName: organization.legalName,
        taxId: organization.taxId,
        email: organization.email,
      },
      report: {
        deliveryDate: contract.reportDeliveryDate ?? undefined,
      },
      taxReport: {
        deliveryDate: contract.taxReportDeliveryDate ?? undefined,
      },
      // Alias legacy: plantillas históricas con {{taxReportDeliveryDate}}.
      taxReportDeliveryDate: contract.taxReportDeliveryDate ?? undefined,
    };
    return { context, missing: [], valid: true };
  }
}
