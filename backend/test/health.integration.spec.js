require('dotenv').config({ path: '.env.test', override: true });

const request = require('supertest');
const { Test } = require('@nestjs/testing');
const { ValidationPipe } = require('@nestjs/common');
const { AppModule } = require('../dist/src/app.module.js');
const { HttpExceptionFilter } = require('../dist/src/common/filters/http-exception.filter.js');
const { PrismaService } = require('../dist/src/database/prisma.service.js');

describe('isolated HTTP integration infrastructure', () => {
  let app;

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL?.includes('sistem_auditoria_test') || !process.env.DATABASE_URL?.includes('sistem_auditoria_test')) {
      throw new Error('Integration tests require the isolated sistem_auditoria_test database');
    }
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => app?.close());

  test('GET /api/health returns ok', async () => {
    await request(app.getHttpServer()).get('/api/health').expect(200).expect({ status: 'ok' });
  });

  test('Prisma is connected to the isolated test database', async () => {
    const prisma = app.get(PrismaService);
    const result = await prisma.$queryRawUnsafe('SELECT current_database() AS name');
    expect(result[0].name).toBe('sistem_auditoria_test');
  });
});
