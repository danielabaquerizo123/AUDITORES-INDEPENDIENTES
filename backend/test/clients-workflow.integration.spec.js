require('dotenv').config({ path: '.env.test', override: true });
const request = require('supertest');
const argon2 = require('argon2');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module');
const { PrismaService } = require('../dist/src/database/prisma.service');
const { grantAdminPermissions } = require('../dist/src/auth/admin-permissions');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter');
jest.setTimeout(30000);
describe('Clientes: permisos, persistencia y transacciones', () => {
 let app, prisma, org, foreignOrg, role, token, client, foreignClient, foreignRep;
 const auth = () => ({ Authorization: `Bearer ${token}` });
  const company = taxId => ({ legalName: 'TEST Empresa Clientes', taxId, economicActivity: 'Servicios profesionales de auditoría externa', email: 'empresa@example.test', country: 'EC', representative: { treatment: 'Sr.', fullName: 'TEST Representante Principal', nationalId: '1234567890', position: 'Gerente General' } });
 beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] }).compile();app=module.createNestApplication();app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalFilters(new HttpExceptionFilter());await app.init();prisma=app.get(PrismaService);
  const db=await prisma.$queryRawUnsafe('SELECT current_database() AS name');if(db[0].name!=='sistem_auditoria_test')throw Error('Test DB required');
  org=await prisma.organization.create({data:{name:`TEST_CLIENTS_${Date.now()}`}});foreignOrg=await prisma.organization.create({data:{name:`TEST_CLIENTS_OTHER_${Date.now()}`}});
  role=await prisma.role.create({data:{organizationId:org.id,name:'ADMIN'}});
  const email=`clients-${org.id}@example.test`;await prisma.user.create({data:{organizationId:org.id,email,passwordHash:await argon2.hash('test-password-only'),firstName:'Test',lastName:'Admin',roles:{create:{roleId:role.id}}}});
  token=(await request(app.getHttpServer()).post('/api/auth/login').send({email,password:'test-password-only'}).expect(201)).body.accessToken;
  foreignClient=await prisma.client.create({data:{organizationId:foreignOrg.id,legalName:'TEST Empresa ajena',taxId:'OTHER',country:'EC'}});foreignRep=await prisma.clientRepresentative.create({data:{clientId:foreignClient.id,fullName:'TEST Ajeno',isPrimary:true}});
 });
 afterAll(async()=>{for(const item of [org,foreignOrg].filter(Boolean)){await prisma.auditLog.deleteMany({where:{organizationId:item.id}});await prisma.generatedDocument.deleteMany({where:{auditPeriod:{client:{organizationId:item.id}}}});await prisma.contract.deleteMany({where:{client:{organizationId:item.id}}});await prisma.auditPeriod.deleteMany({where:{client:{organizationId:item.id}}});await prisma.client.deleteMany({where:{organizationId:item.id}});await prisma.userRole.deleteMany({where:{user:{organizationId:item.id}}});await prisma.user.deleteMany({where:{organizationId:item.id}});await prisma.rolePermission.deleteMany({where:{role:{organizationId:item.id}}});await prisma.role.deleteMany({where:{organizationId:item.id}});await prisma.organization.delete({where:{id:item.id}});}await app?.close();});
 test('reproduce 403 y lo corrige con permisos persistidos, sin omitir guards',async()=>{
  await request(app.getHttpServer()).get('/api/clients').expect(401);
  await request(app.getHttpServer()).get('/api/clients').set(auth()).expect(403);
  await prisma.$transaction(tx=>grantAdminPermissions(tx,role.id));
  await prisma.$transaction(tx=>grantAdminPermissions(tx,role.id));
  await request(app.getHttpServer()).get('/api/clients').set(auth()).expect(200);
  const me=await request(app.getHttpServer()).get('/api/auth/me').set(auth()).expect(200);expect(me.body.permissions).toEqual(expect.arrayContaining(['clients.read','clients.create','clients.update','clients.delete']));expect(new Set(me.body.permissions).size).toBe(me.body.permissions.length);
 });
  test('crea y lee compañía y representante en PostgreSQL',async()=>{
   const response=await request(app.getHttpServer()).post('/api/clients').set(auth()).send(company('TEST-RUC-1')).expect(201);client=response.body;
   expect(client.representatives[0]).toEqual(expect.objectContaining({treatment:'Sr.',fullName:'TEST Representante Principal',isPrimary:true}));
   expect(client.taxId).toBe('TEST-RUC-1');
   const persisted=await prisma.client.findUnique({where:{id:client.id},include:{representatives:true}});expect(persisted.representatives[0].nationalId).toBe('1234567890');expect(persisted.representatives[0].treatment).toBe('Sr.');
   await request(app.getHttpServer()).get(`/api/clients/${client.id}/representatives`).set(auth()).expect(200);
  });
  test('rechaza duplicados y representante inválido sin dejar compañías parciales',async()=>{
   await request(app.getHttpServer()).post('/api/clients').set(auth()).send(company('TEST-RUC-1')).expect(409);
   for(const key of ['treatment','fullName','nationalId','position']){const dto=company('INVALID');dto.representative[key]=' ';await request(app.getHttpServer()).post('/api/clients').set(auth()).send(dto).expect(400);}
   const badTreatment=company('INVALID-TREATMENT');badTreatment.representative.treatment='Dr.';await request(app.getHttpServer()).post('/api/clients').set(auth()).send(badTreatment).expect(400);
   const dto=company('INVALID');dto.email='incorrecto';await request(app.getHttpServer()).post('/api/clients').set(auth()).send(dto).expect(400);
   const noRep=company('INVALID-NOREP');delete noRep.representative;await request(app.getHttpServer()).post('/api/clients').set(auth()).send(noRep).expect(400);
   expect(await prisma.client.count({where:{organizationId:org.id}})).toBe(1);
  });
  test('edita RUC, compañía y representante; conserva ceros iniciales como texto',async()=>{
   const dto={...company('0012345678002'),legalName:'TEST Empresa Editada',email:'editada@example.test',representative:{...company('').representative,id:client.representatives[0].id,treatment:'Sra.',fullName:'TEST María Búsqueda'}};
   const updated=await request(app.getHttpServer()).patch(`/api/clients/${client.id}`).set(auth()).send(dto).expect(200);expect(updated.body.email).toBe('editada@example.test');expect(updated.body.taxId).toBe('0012345678002');expect(updated.body.representatives).toHaveLength(1);expect(updated.body.representatives[0].treatment).toBe('Sra.');
   const read=await request(app.getHttpServer()).get(`/api/clients/${client.id}`).set(auth()).expect(200);expect(read.body.taxId).toBe('0012345678002');expect(read.body.representatives[0].fullName).toBe('TEST María Búsqueda');
  });
 test('aísla organizaciones y revierte compañía si falla la actualización del representante',async()=>{
  await request(app.getHttpServer()).get(`/api/clients/${foreignClient.id}`).set(auth()).expect(404);
  await request(app.getHttpServer()).patch(`/api/clients/${client.id}`).set(auth()).send({legalName:'NO DEBE GUARDARSE',representative:{...company('').representative,id:foreignRep.id}}).expect(404);
  expect((await prisma.client.findUnique({where:{id:client.id}})).legalName).toBe('TEST Empresa Editada');
 });
 test('busca en backend por empresa, RUC y representante y pagina sin duplicados',async()=>{
     for(const search of ['Editada','0012345678002','maría']){const r=await request(app.getHttpServer()).get('/api/clients').query({page:1,pageSize:5,search}).set(auth()).expect(200);expect(r.body.total).toBe(1);expect(r.body.items[0].id).toBe(client.id);}
  for(let i=0;i<6;i++)await request(app.getHttpServer()).post('/api/clients').set(auth()).send({...company(`PAGE-${i}`),legalName:`TEST Página ${i}`}).expect(201);
  const first=await request(app.getHttpServer()).get('/api/clients?page=1&pageSize=5').set(auth()).expect(200);const second=await request(app.getHttpServer()).get('/api/clients?page=2&pageSize=5').set(auth()).expect(200);expect(first.body.total).toBe(7);expect(first.body.items).toHaveLength(5);expect(second.body.items).toHaveLength(2);expect(new Set([...first.body.items,...second.body.items].map(c=>c.id)).size).toBe(7);
  await request(app.getHttpServer()).get('/api/clients?page=0').set(auth()).expect(400);
 });
 test('elimina lógicamente, preserva contratos y documentos, e impide contratos nuevos',async()=>{
  const withoutContract=(await request(app.getHttpServer()).post('/api/clients').set(auth()).send(company('DELETE-WITHOUT-CONTRACT'))).body;
  await request(app.getHttpServer()).delete(`/api/clients/${withoutContract.id}`).set(auth()).expect(200);
  expect(await prisma.client.findUnique({where:{id:withoutContract.id}})).toEqual(expect.objectContaining({deletedAt:expect.any(Date)}));
  const hidden=await request(app.getHttpServer()).get('/api/clients').query({search:'DELETE-WITHOUT-CONTRACT'}).set(auth()).expect(200);expect(hidden.body.total).toBe(0);
  await request(app.getHttpServer()).get(`/api/clients/${withoutContract.id}`).set(auth()).expect(404);
  const withContract=(await request(app.getHttpServer()).post('/api/clients').set(auth()).send(company('DELETE-WITH-CONTRACT'))).body;
  const period=await prisma.auditPeriod.create({data:{clientId:withContract.id,label:'Período eliminación',fiscalYear:2099,startDate:new Date('2099-01-01'),endDate:new Date('2099-12-31')}});
  const user=await prisma.user.findFirstOrThrow({where:{organizationId:org.id}});const contract=await prisma.contract.create({data:{clientId:withContract.id,auditPeriodId:period.id,createdById:user.id,updatedById:user.id}});
  const document=await prisma.generatedDocument.create({data:{auditPeriodId:period.id,contractId:contract.id,type:'CONTRACT',title:'Documento histórico',storageKey:'test/history.docx'}});
  const removed=await request(app.getHttpServer()).delete(`/api/clients/${withContract.id}`).set(auth()).expect(200);expect(removed.body.contractCount).toBe(1);
  expect(await prisma.contract.findUnique({where:{id:contract.id}})).toEqual(expect.objectContaining({clientId:withContract.id}));expect(await prisma.generatedDocument.findUnique({where:{id:document.id}})).toEqual(expect.objectContaining({contractId:contract.id}));
  await request(app.getHttpServer()).post('/api/contracts').set(auth()).send({clientId:withContract.id,auditedYear:2100}).expect(404);
 });
 test('controla la eliminación cancelada en el servidor mediante ausencia de solicitud y el cliente inexistente',async()=>{
  await request(app.getHttpServer()).delete('/api/clients/cliente-inexistente').set(auth()).expect(404);
 });
});
