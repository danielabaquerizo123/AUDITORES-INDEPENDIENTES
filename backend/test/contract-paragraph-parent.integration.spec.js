require('dotenv').config({path:'.env.test',override:true});
const request=require('supertest'),argon2=require('argon2');
const {Test}=require('@nestjs/testing');const {ValidationPipe}=require('@nestjs/common');
const {AppModule}=require('../dist/src/app.module');const {PrismaService}=require('../dist/src/database/prisma.service');const {grantAdminPermissions}=require('../dist/src/auth/admin-permissions');
jest.setTimeout(30000);
describe('Párrafos manuales por cláusula propietaria',()=>{
 let app,prisma,org,token,contract;
 const auth=()=>({Authorization:`Bearer ${token}`});
 beforeAll(async()=>{
  const module=await Test.createTestingModule({imports:[AppModule]}).compile();app=module.createNestApplication();app.setGlobalPrefix('api');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));await app.init();prisma=app.get(PrismaService);
  org=await prisma.organization.create({data:{name:`TEST_PARAGRAPH_PARENT_${Date.now()}`}});const role=await prisma.role.create({data:{organizationId:org.id,name:'ADMIN'}});await prisma.$transaction(tx=>grantAdminPermissions(tx,role.id));
  const email=`paragraph-${org.id}@example.test`;await prisma.user.create({data:{organizationId:org.id,email,passwordHash:await argon2.hash('test-paragraph'),firstName:'Test',lastName:'Admin',roles:{create:{roleId:role.id}}}});token=(await request(app.getHttpServer()).post('/api/auth/login').send({email,password:'test-paragraph'}).expect(201)).body.accessToken;
  const client=(await request(app.getHttpServer()).post('/api/clients').set(auth()).send({legalName:'TEST PARRAFOS S.A.',taxId:'0997654321001',economicActivity:'Servicios profesionales',email:'cliente@example.test',country:'EC',representative:{treatment:'Sra.',fullName:'María Prueba',nationalId:'1234567890',position:'Gerente General'}}).expect(201)).body;
  contract=(await request(app.getHttpServer()).post('/api/contracts').set(auth()).send({clientId:client.id,auditedYear:2031}).expect(201)).body;
 });
 afterAll(async()=>{if(org){const where={client:{organizationId:org.id}};await prisma.auditLog.deleteMany({where:{organizationId:org.id}});await prisma.contract.deleteMany({where});await prisma.auditPeriod.deleteMany({where});await prisma.client.deleteMany({where:{organizationId:org.id}});await prisma.userRole.deleteMany({where:{user:{organizationId:org.id}}});await prisma.user.deleteMany({where:{organizationId:org.id}});await prisma.rolePermission.deleteMany({where:{role:{organizationId:org.id}}});await prisma.role.deleteMany({where:{organizationId:org.id}});await prisma.organization.delete({where:{id:org.id}})}await app?.close()});
 test('persiste PRIMERA, SEGUNDA y TERCERA bajo su padre real tras recargar',async()=>{
  const id=key=>contract.clauses.find(clause=>clause.clauseKey===key).id;
  await request(app.getHttpServer()).post(`/api/contracts/${contract.id}/clauses/${id('p2')}/paragraphs`).set(auth()).send({body:'PÁRRAFO PRIMERA'}).expect(201);
  await request(app.getHttpServer()).post(`/api/contracts/${contract.id}/clauses/${id('p5')}/paragraphs`).set(auth()).send({body:'PÁRRAFO SEGUNDA'}).expect(201);
  await request(app.getHttpServer()).post(`/api/contracts/${contract.id}/clauses/${id('p7')}/paragraphs`).set(auth()).send({body:'PÁRRAFO TERCERA'}).expect(201);
  const reloaded=(await request(app.getHttpServer()).get(`/api/contracts/${contract.id}`).set(auth()).expect(200)).body;
  const added=Object.fromEntries(reloaded.clauses.filter(clause=>clause.isCustom).map(clause=>[clause.body,clause.parentClauseKey]));
  expect(added).toEqual({'PÁRRAFO PRIMERA':'p2','PÁRRAFO SEGUNDA':'p5','PÁRRAFO TERCERA':'p7'});
 });
});
