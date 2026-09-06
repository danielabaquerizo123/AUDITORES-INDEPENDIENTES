require('dotenv').config({path:'.env.test',override:true});
const request=require('supertest'),argon2=require('argon2'),fs=require('fs'),JSZip=require('jszip');
const {Test}=require('@nestjs/testing');const {ValidationPipe}=require('@nestjs/common');
const {AppModule}=require('../dist/src/app.module');const {PrismaService}=require('../dist/src/database/prisma.service');const {grantAdminPermissions}=require('../dist/src/auth/admin-permissions');
const {resolveGeneratedDir}=require('../dist/src/contracts/documents/contract-document.builder');
const {join}=require('path');
jest.setTimeout(30000);
describe('Contrato oficial persistente',()=>{
 let app,prisma,org,token,client,contract;const auth=()=>({Authorization:`Bearer ${token}`});
 beforeAll(async()=>{
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();prisma=app.get(PrismaService);
  expect((await prisma.$queryRawUnsafe('SELECT current_database() AS name'))[0].name).toBe('sistem_auditoria_test');
  org=await prisma.organization.create({data:{name:`TEST_CONTRACT_OFFICIAL_${Date.now()}`}});const role=await prisma.role.create({data:{organizationId:org.id,name:'ADMIN'}});await prisma.$transaction(tx=>grantAdminPermissions(tx,role.id));
  const email=`official-${org.id}@example.test`;await prisma.user.create({data:{organizationId:org.id,email,passwordHash:await argon2.hash('test-contract-only'),firstName:'TEST',lastName:'Admin',roles:{create:{roleId:role.id}}}});
  token=(await request(app.getHttpServer()).post('/api/auth/login').send({email,password:'test-contract-only'}).expect(201)).body.accessToken;
  client=(await request(app.getHttpServer()).post('/api/clients').set(auth()).send({legalName:'TEST TIA S.A.',taxId:'0091234567001',economicActivity:'Servicios profesionales',email:'empresa@example.test',country:'EC',representative:{treatment:'Sra.',fullName:'TEST María Pérez',nationalId:'0123456789',position:'Gerente General'}}).expect(201)).body;
 });
 afterAll(async()=>{if(org){const where={client:{organizationId:org.id}};const docs=await prisma.generatedDocument.findMany({where:{contract:where}});for(const d of docs)if(d.storageKey)fs.rmSync(join(resolveGeneratedDir(),d.storageKey),{force:true});await prisma.generatedDocument.deleteMany({where:{contract:where}});await prisma.auditLog.deleteMany({where:{organizationId:org.id}});await prisma.contract.deleteMany({where});await prisma.auditPeriod.deleteMany({where});await prisma.client.deleteMany({where:{organizationId:org.id}});await prisma.userRole.deleteMany({where:{user:{organizationId:org.id}}});await prisma.user.deleteMany({where:{organizationId:org.id}});await prisma.rolePermission.deleteMany({where:{role:{organizationId:org.id}}});await prisma.role.deleteMany({where:{organizationId:org.id}});await prisma.organization.delete({where:{id:org.id}})}await app?.close()});
 test('exige autenticación y valida año/cliente',async()=>{await request(app.getHttpServer()).post('/api/contracts').send({clientId:client.id,auditedYear:2027}).expect(401);await request(app.getHttpServer()).post('/api/contracts').set(auth()).send({clientId:client.id,auditedYear:0}).expect(400);await request(app.getHttpServer()).post('/api/contracts').set(auth()).send({clientId:'foreign',auditedYear:2027}).expect(404)});
 test('prepara copia con datos seguros sin derivar fechas',async()=>{contract=(await request(app.getHttpServer()).post('/api/contracts').set(auth()).send({clientId:client.id,auditedYear:2027}).expect(201)).body;expect(contract.variables.values.REPRESENTATIVE_TITLE).toBe('Sra.');expect(contract.signingDate).toBeNull();expect(contract.clauses.find(s=>s.clauseKey==='p60').body).toContain('2025');expect(contract.clauses.find(s=>s.clauseKey==='p46').body).toContain('2026');expect(contract.clauses.find(s=>s.clauseKey==='p1').body).toContain('2027');await request(app.getHttpServer()).post('/api/contracts').set(auth()).send({clientId:client.id,auditedYear:2027}).expect(409)});
 test('guarda edición, protege conflictos y genera Word con versión guardada',async()=>{
  const sections=contract.clauses.map(s=>({clauseKey:s.clauseKey,body:s.body.replace('10 días hábiles','20 días hábiles')}));
  await request(app.getHttpServer()).patch(`/api/contracts/${contract.id}`).set(auth()).send({sections:[{clauseKey:'p999',body:'foreign'}],expectedUpdatedAt:contract.updatedAt}).expect(400);
  await request(app.getHttpServer()).patch(`/api/contracts/${contract.id}`).set(auth()).send({sections,expectedUpdatedAt:contract.updatedAt}).expect(200);
  await request(app.getHttpServer()).patch(`/api/contracts/${contract.id}`).set(auth()).send({sections,expectedUpdatedAt:contract.updatedAt}).expect(409);
  const preview=(await request(app.getHttpServer()).get(`/api/contracts/${contract.id}/preview`).set(auth()).expect(200)).body;expect(preview.sections.find(s=>s.clauseKey==='p45').body).toContain('20 días hábiles');
  const doc=(await request(app.getHttpServer()).post(`/api/contracts/${contract.id}/documents`).set(auth()).send({format:'docx'}).expect(201)).body;const record=await prisma.generatedDocument.findUnique({where:{id:doc.id}});const zip=await JSZip.loadAsync(fs.readFileSync(join(resolveGeneratedDir(),record.storageKey)));expect((await zip.file('word/document.xml').async('string')).replace(/<[^>]+>/g,'')).toContain('20 días hábiles');expect(doc.originalFileName).toBe('Contrato_TEST_TIA_S_A_2027.docx');
 });
});
