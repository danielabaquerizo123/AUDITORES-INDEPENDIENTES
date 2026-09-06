const argon2 = require('argon2');

const permissionKeys = ['clients.read', 'clients.create', 'clients.update', 'periods.read', 'periods.create', 'periods.update', 'contracts.read', 'contracts.create', 'contracts.update'];

async function assertTestDatabase(prisma) {
  const result = await prisma.$queryRawUnsafe('SELECT current_database() AS name');
  if (result[0].name !== 'sistem_auditoria_test') throw new Error('Tenant fixtures require sistem_auditoria_test');
}

async function createTenantFixtures(prisma) {
  await assertTestDatabase(prisma);
  const suffix = `tenant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  for (const key of permissionKeys) await prisma.permission.upsert({ where: { key }, update: {}, create: { key } });
  const permissions = await prisma.permission.findMany({ where: { key: { in: permissionKeys } } });
  const orgA = await prisma.organization.create({ data: { name: `TEST_TENANT_A_${suffix}` } });
  const orgB = await prisma.organization.create({ data: { name: `TEST_TENANT_B_${suffix}` } });
  const roleA = await prisma.role.create({ data: { organizationId: orgA.id, name: `TEST_ADMIN_A_${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
  const roleB = await prisma.role.create({ data: { organizationId: orgB.id, name: `TEST_ADMIN_B_${suffix}`, permissions: { create: permissions.map((permission) => ({ permissionId: permission.id })) } } });
  const hash = await argon2.hash(`fixture-${suffix}`, { type: argon2.argon2id });
  const userA = await prisma.user.create({ data: { organizationId: orgA.id, email: `test-a-${suffix}@example.test`, passwordHash: hash, firstName: 'Tenant', lastName: 'A', roles: { create: { roleId: roleA.id } } } });
  const userB = await prisma.user.create({ data: { organizationId: orgB.id, email: `test-b-${suffix}@example.test`, passwordHash: hash, firstName: 'Tenant', lastName: 'B', roles: { create: { roleId: roleB.id } } } });
  const clientA = await prisma.client.create({ data: { organizationId: orgA.id, legalName: `TEST Client A ${suffix}`, taxId: `A-${suffix}`, country: 'EC' } });
  const clientB = await prisma.client.create({ data: { organizationId: orgB.id, legalName: `TEST Client B ${suffix}`, taxId: `B-${suffix}`, country: 'EC' } });
  const representativeA = await prisma.clientRepresentative.create({ data: { clientId: clientA.id, fullName: 'TEST Representative A', isPrimary: true } });
  const representativeB = await prisma.clientRepresentative.create({ data: { clientId: clientB.id, fullName: 'TEST Representative B', isPrimary: true } });
  const periodA = await prisma.auditPeriod.create({ data: { clientId: clientA.id, label: 'TEST Period A', fiscalYear: 2031, startDate: new Date('2031-01-01'), endDate: new Date('2031-12-31') } });
  const periodB = await prisma.auditPeriod.create({ data: { clientId: clientB.id, label: 'TEST Period B', fiscalYear: 2031, startDate: new Date('2031-01-01'), endDate: new Date('2031-12-31') } });
  const templateA = await prisma.contractTemplate.create({ data: { organizationId: orgA.id, name: `TEST Template A ${suffix}`, version: 1, clauses: { create: { clauseKey: 'test-a', title: 'TEST Clause A', body: 'TEST CLAUSE TENANT A', sortOrder: 1 } } }, include: { clauses: true } });
  const templateB = await prisma.contractTemplate.create({ data: { organizationId: orgB.id, name: `TEST Template B ${suffix}`, version: 1, clauses: { create: { clauseKey: 'test-b', title: 'TEST Clause B', body: 'TEST CLAUSE TENANT B', sortOrder: 1 } } }, include: { clauses: true } });
  const contractA = await prisma.contract.create({ data: { clientId: clientA.id, auditPeriodId: periodA.id, templateId: templateA.id, createdById: userA.id, updatedById: userA.id, clauses: { create: { clauseKey: 'test-a', title: 'TEST Clause A', body: 'TEST CLAUSE TENANT A', sortOrder: 1, sourceTemplateClauseId: templateA.clauses[0].id } } }, include: { clauses: true } });
  const contractB = await prisma.contract.create({ data: { clientId: clientB.id, auditPeriodId: periodB.id, templateId: templateB.id, createdById: userB.id, updatedById: userB.id, clauses: { create: { clauseKey: 'test-b', title: 'TEST Clause B', body: 'TEST CLAUSE TENANT B', sortOrder: 1, sourceTemplateClauseId: templateB.clauses[0].id } } }, include: { clauses: true } });
  return { suffix, password: `fixture-${suffix}`, organizationA: orgA, organizationB: orgB, roleA, roleB, userAdminA: userA, userAdminB: userB, clientA, clientB, representativeA, representativeB, periodA, periodB, templateA, templateB, templateClauseA: templateA.clauses[0], templateClauseB: templateB.clauses[0], contractA, contractB, contractClauseA: contractA.clauses[0], contractClauseB: contractB.clauses[0] };
}

async function cleanupTenantFixtures(prisma, fixtures) {
  await assertTestDatabase(prisma);
  await prisma.auditLog.deleteMany({ where: { organizationId: { in: [fixtures.organizationA.id, fixtures.organizationB.id] } } });
  await prisma.contract.deleteMany({ where: { id: { in: [fixtures.contractA.id, fixtures.contractB.id] } } });
  await prisma.contractTemplate.deleteMany({ where: { id: { in: [fixtures.templateA.id, fixtures.templateB.id] } } });
  await prisma.auditPeriod.deleteMany({ where: { id: { in: [fixtures.periodA.id, fixtures.periodB.id] } } });
  await prisma.clientRepresentative.deleteMany({ where: { id: { in: [fixtures.representativeA.id, fixtures.representativeB.id] } } });
  await prisma.client.deleteMany({ where: { id: { in: [fixtures.clientA.id, fixtures.clientB.id] } } });
  await prisma.userRole.deleteMany({ where: { userId: { in: [fixtures.userAdminA.id, fixtures.userAdminB.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [fixtures.userAdminA.id, fixtures.userAdminB.id] } } });
  await prisma.rolePermission.deleteMany({ where: { roleId: { in: [fixtures.roleA.id, fixtures.roleB.id] } } });
  await prisma.role.deleteMany({ where: { id: { in: [fixtures.roleA.id, fixtures.roleB.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [fixtures.organizationA.id, fixtures.organizationB.id] } } });
}
module.exports = { assertTestDatabase, createTenantFixtures, cleanupTenantFixtures };
