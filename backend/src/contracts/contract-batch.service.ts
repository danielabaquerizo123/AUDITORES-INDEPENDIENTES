import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { PrismaService } from '../database/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ContractsService } from './contracts.service';
import type { GeneratedFormat } from './documents/contract-document.builder';

export type BatchStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'COMPLETED_WITH_ERRORS'
  | 'FAILED';

export interface BatchItemResult {
  contractId: string;
  status: 'SUCCESS' | 'FAILED';
  documentId?: string;
  errors: string[];
}

export interface BatchJobSnapshot {
  id: string;
  status: BatchStatus;
  format: GeneratedFormat;
  total: number;
  processed: number;
  successful: number;
  failed: number;
  results: BatchItemResult[];
  createdAt: Date;
  finishedAt: Date | null;
}

interface BatchJob extends BatchJobSnapshot {
  organizationId: string;
  userId: string;
  contractIds: string[];
}

const MAX_BATCH_SIZE = 50;
// Ventana de deduplicación: un doble click accidental con los mismos
// parámetros devuelve el job existente en lugar de crear otro.
const IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

/**
 * Generación masiva en proceso (Fase 4).
 *
 * BullMQ/Redis NO se utiliza para cerrar Fase 4: Redis no está garantizado
 * en el entorno local y la aplicación debe arrancar sin él. Este servicio
 * reutiliza EXACTAMENTE el pipeline individual
 * (ContractsService.generateContractDocument) por cada contrato, con
 * resultados parciales: un contrato inválido no cancela los válidos.
 */
@Injectable()
export class ContractBatchService {
  private readonly jobs = new Map<string, BatchJob>();
  private readonly idempotency = new Map<string, { jobId: string; expiresAt: number }>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly contracts: ContractsService,
    private readonly audit: AuditLogService,
  ) {}

  async start(
    organizationId: string,
    userId: string,
    contractIds: string[],
    format: GeneratedFormat,
  ): Promise<BatchJobSnapshot> {
    const unique = [...new Set((contractIds ?? []).filter((id) => typeof id === 'string' && id.length > 0))];
    if (unique.length === 0) {
      throw new BadRequestException('Seleccione al menos un contrato');
    }
    if (unique.length > MAX_BATCH_SIZE) {
      throw new BadRequestException(`Máximo ${MAX_BATCH_SIZE} contratos por lote`);
    }

    // Verificación tenant ANTES de encolar: ningún contrato ajeno entra al job.
    const owned = await this.prisma.contract.findMany({
      where: { id: { in: unique }, client: { organizationId } },
      select: { id: true },
    });
    const ownedIds = new Set(owned.map((row) => row.id));
    const foreign = unique.filter((id) => !ownedIds.has(id));
    if (foreign.length > 0) {
      throw new NotFoundException(`Contratos no encontrados en su organización: ${foreign.join(', ')}`);
    }

    const key = createHash('sha256')
      .update([organizationId, userId, ...[...unique].sort(), format].join('|'))
      .digest('hex');
    const now = Date.now();
    for (const [hash, entry] of this.idempotency) {
      if (entry.expiresAt <= now) this.idempotency.delete(hash);
    }
    const existing = this.idempotency.get(key);
    if (existing) {
      const job = this.jobs.get(existing.jobId);
      if (job && job.organizationId === organizationId) return this.snapshot(job);
    }

    const job: BatchJob = {
      id: randomUUID(),
      organizationId,
      userId,
      contractIds: unique,
      format,
      status: 'QUEUED',
      total: unique.length,
      processed: 0,
      successful: 0,
      failed: 0,
      results: [],
      createdAt: new Date(),
      finishedAt: null,
    };
    this.jobs.set(job.id, job);
    this.idempotency.set(key, { jobId: job.id, expiresAt: now + IDEMPOTENCY_WINDOW_MS });

    await this.audit.record({
      organizationId,
      actorUserId: userId,
      action: 'CONTRACT_BATCH_STARTED',
      entityType: 'ContractBatch',
      entityId: job.id,
      after: { contractIds: unique, format, total: unique.length },
    });

    // Procesamiento asíncrono en proceso; el endpoint responde de inmediato.
    setImmediate(() => void this.process(job.id));
    return this.snapshot(job);
  }

  get(organizationId: string, jobId: string): BatchJobSnapshot {
    const job = this.jobs.get(jobId);
    // Defense in depth: el job solo es visible dentro de su tenant.
    if (!job || job.organizationId !== organizationId) {
      throw new NotFoundException('Batch job not found');
    }
    return this.snapshot(job);
  }

  private snapshot(job: BatchJob): BatchJobSnapshot {
    return {
      id: job.id,
      status: job.status,
      format: job.format,
      total: job.total,
      processed: job.processed,
      successful: job.successful,
      failed: job.failed,
      results: job.results.map((result) => ({ ...result })),
      createdAt: job.createdAt,
      finishedAt: job.finishedAt,
    };
  }

  private async process(jobId: string): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job || job.status !== 'QUEUED') return;
    job.status = 'PROCESSING';
    for (const contractId of job.contractIds) {
      try {
        // Mismo núcleo que la generación individual (defense in depth:
        // el núcleo vuelve a filtrar por tenant).
        const document = await this.contracts.generateContractDocument(
          job.organizationId,
          job.userId,
          contractId,
          job.format,
        );
        job.results.push({
          contractId,
          status: 'SUCCESS',
          documentId: (document as { id: string }).id,
          errors: [],
        });
        job.successful += 1;
      } catch (error) {
        job.results.push({ contractId, status: 'FAILED', errors: await this.describeFailure(job, contractId, error) });
        job.failed += 1;
      }
      job.processed += 1;
    }
    job.finishedAt = new Date();
    job.status =
      job.failed === 0 ? 'COMPLETED' : job.successful === 0 ? 'FAILED' : 'COMPLETED_WITH_ERRORS';
    await this.audit.record({
      organizationId: job.organizationId,
      actorUserId: job.userId,
      action: 'CONTRACT_BATCH_FINISHED',
      entityType: 'ContractBatch',
      entityId: job.id,
      after: { total: job.total, successful: job.successful, failed: job.failed, status: job.status },
    });
  }

  private async describeFailure(job: BatchJob, contractId: string, error: unknown): Promise<string[]> {
    const response =
      typeof error === 'object' && error !== null && 'getResponse' in error
        ? (error as { getResponse: () => unknown }).getResponse()
        : null;
    if (response && typeof response === 'object' && 'message' in response) {
      const message = (response as { message: unknown }).message;
      if (Array.isArray(message)) return message.map(String);
      if (typeof message === 'string') return [message];
    }
    try {
      const validation = await this.contracts.validate(job.organizationId, contractId);
      if (validation.errors.length > 0) return validation.errors;
    } catch {
      // Sin contexto válido no hay detalle adicional.
    }
    return [error instanceof Error ? error.message : 'No fue posible generar el documento'];
  }
}
