import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import {
  APPROVED_P52_REPAIR_BODY,
  APPROVED_P52_REPAIR_CONTRACT_ID,
  LEGACY_UAFE_CLAUSE_KEY,
  OFFICIAL_UAFE_CLAUSE_KEY,
  OFFICIAL_UAFE_BODY,
  planOfficialContractContentUpdate,
  type OfficialClauseContent,
  type OfficialContractContentState,
} from '../src/contracts/official-contract-content';

type Args = { apply: boolean; organizationId?: string; confirmOrganization?: string };
type DbClause = OfficialClauseContent & { contractId: string };
type DbContract = OfficialContractContentState & {
  organizationId: string;
  clauses: DbClause[];
};

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--dry-run') args.apply = false;
    else if (arg === '--apply') args.apply = true;
    else if (arg === '--organization-id') args.organizationId = argv[++index];
    else if (arg === '--confirm-organization') args.confirmOrganization = argv[++index];
    else throw new Error(`Argumento no reconocido: ${arg}`);
  }
  if (args.apply && (!args.organizationId || args.confirmOrganization !== args.organizationId)) {
    throw new Error('Para aplicar, indique --organization-id y repita el mismo valor en --confirm-organization.');
  }
  return args;
}

async function readTemplateMap() {
  const path = resolve(process.cwd(), 'storage/templates/contracts/template-map.json');
  const content = await readFile(path, 'utf8');
  return JSON.parse(content) as { version: string; paragraphs: string[] };
}

function summarizePlan(plan: ReturnType<typeof planOfficialContractContentUpdate>) {
  return {
    changes: plan.changes.map(change => `${change.clauseKey}: ${change.reasons.join('; ')}`),
    creates: plan.creates.map(create => `${create.clauseKey}: ${create.reason}`),
    manualReview: plan.manualReview.map(item => `${item.clauseKey}: ${item.reason}`),
  };
}

function sameDate(left: Date | undefined, right: Date | undefined) {
  return left?.getTime() === right?.getTime();
}

const jsonObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};

async function verifiedHistoricalP52Email(prisma: PrismaClient, contractId: string): Promise<string | undefined> {
  if (contractId !== APPROVED_P52_REPAIR_CONTRACT_ID) return undefined;
  const documents = await prisma.generatedDocument.findMany({ where: { contractId }, select: { variablesSnapshot: true } });
  const pattern = /^Por " El Auditor": {2}Mail: (\S+)$/;
  const evidence: { bodyEmail: string; snapshotEmail: unknown }[] = [];
  for (const document of documents) {
    const root = jsonObject(document.variablesSnapshot);
    const sections = Array.isArray(root.sections) ? root.sections : [];
    const p52 = sections.map(jsonObject).find(section => section.clauseKey === 'p52');
    if (p52?.body !== APPROVED_P52_REPAIR_BODY) continue;
    const snapshot = jsonObject(root.snapshot);
    const auditor = jsonObject(snapshot.AUDITOR ?? root.AUDITOR);
    const match = APPROVED_P52_REPAIR_BODY.match(pattern);
    if (match) evidence.push({ bodyEmail: match[1], snapshotEmail: auditor.email });
  }
  if (!evidence.length) return undefined;
  const candidate = evidence[0].bodyEmail;
  return evidence.every(item => item.bodyEmail === candidate && item.snapshotEmail === candidate) ? candidate : undefined;
}

async function applyPlan(prisma: PrismaClient, contract: DbContract, plan: ReturnType<typeof planOfficialContractContentUpdate>) {
  await prisma.$transaction(async tx => {
    const current = await tx.contract.findFirst({
      where: { id: contract.id, client: { organizationId: contract.organizationId } },
      include: { clauses: true },
    });
    if (!current || !sameDate(current.updatedAt, contract.updatedAt)) throw new Error('El contrato cambió desde la previsualización.');

    for (const change of plan.changes) {
      const row = current.clauses.find(clause => clause.id === change.clauseId);
      const expected = change.expected;
      if (!row || row.clauseKey !== expected.clauseKey || row.body !== expected.body || row.sortOrder !== expected.sortOrder ||
        row.isCustom !== expected.isCustom || row.parentClauseKey !== expected.parentClauseKey || !sameDate(row.updatedAt, expected.updatedAt)) {
        throw new Error(`La cláusula ${change.clauseKey} cambió desde la previsualización.`);
      }
      await tx.contractClause.update({ where: { id: row.id }, data: change.data });
    }

    for (const create of plan.creates) {
      const parent = current.clauses.find(clause => clause.clauseKey === 'p57');
      if (!parent || parent.sortOrder !== create.sortOrder || current.clauses.some(clause =>
        clause.clauseKey === create.clauseKey || clause.clauseKey === LEGACY_UAFE_CLAUSE_KEY || clause.body.normalize('NFC').replace(/\s+/g, ' ').trim() === OFFICIAL_UAFE_BODY.normalize('NFC').replace(/\s+/g, ' ').trim(),
      )) {
        throw new Error('Cambió el ancla o apareció una fila UAFE desde la previsualización.');
      }
      await tx.contractClause.create({
        data: {
          contractId: current.id,
          clauseKey: create.clauseKey,
          title: create.title,
          body: create.body,
          sortOrder: create.sortOrder,
          isCustom: create.isCustom,
          parentClauseKey: create.parentClauseKey,
        },
      });
    }
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const template = await readTemplateMap();
  const prisma = new PrismaClient();
  try {
    const records = await prisma.contract.findMany({
      where: args.organizationId ? { client: { organizationId: args.organizationId } } : undefined,
      include: {
        client: { select: { organizationId: true } },
        clauses: { orderBy: [{ sortOrder: 'asc' }, { clauseKey: 'asc' }] },
      },
    });
    const official = records.filter(contract => {
      const variables = contract.variables;
      return !!variables && typeof variables === 'object' && !Array.isArray(variables) && variables.templateVersion === template.version;
    });
    const excluded = records.length - official.length;
    let changed = 0;
    let manualCount = 0;
    let legacyCount = 0;

    for (const record of official) {
      const contract: DbContract = {
        id: record.id,
        variables: record.variables,
        auditorSnapshot: record.auditorSnapshot,
        updatedAt: record.updatedAt,
        organizationId: record.client.organizationId,
        clauses: record.clauses as DbClause[],
      };
      const historicalP52Email = await verifiedHistoricalP52Email(prisma, contract.id);
      const plan = planOfficialContractContentUpdate(contract, template.paragraphs, { verifiedHistoricalP52Email: historicalP52Email });
      const summary = summarizePlan(plan);
      const operations = summary.changes.length + summary.creates.length;
      if (operations) changed += 1;
      if (plan.manualReview.length) manualCount += 1;
      if (plan.changes.some(change => change.clauseKey === LEGACY_UAFE_CLAUSE_KEY)) legacyCount += 1;
      process.stdout.write(`${args.apply ? '[apply]' : '[dry-run]'} contract=${record.id} updates=${summary.changes.length} creates=${summary.creates.length} review=${summary.manualReview.length}\n`);
      for (const item of summary.changes) process.stdout.write(`  UPDATE ${item}\n`);
      for (const item of summary.creates) process.stdout.write(`  CREATE ${item}\n`);
      for (const item of summary.manualReview) process.stdout.write(`  REVIEW ${item}\n`);
      if (args.apply && operations) await applyPlan(prisma, contract, plan);
    }
    process.stdout.write(`Resumen: analizados=${official.length}; con_cambios=${changed}; requieren_revision=${manualCount}; excluidos_no_oficiales=${excluded}; custom-uafe_legados=${legacyCount}; modo=${args.apply ? 'apply' : 'dry-run'}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(error => {
  const message = error instanceof Error ? error.message : 'Error inesperado';
  process.stderr.write(`No se completó la actualización de contenido oficial: ${message}\n`);
  process.exitCode = 1;
});
