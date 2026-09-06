import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { AuthModule } from './auth/auth.module';
import { AuditLogModule } from './audit-log/audit-log.module';
import { AuditPeriodsModule } from './audit-periods/audit-periods.module';
import { ClientsModule } from './clients/clients.module';
import { ContractsModule } from './contracts/contracts.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DatabaseModule } from './database/database.module';
import { DocumentsModule } from './documents/documents.module';
import { FinancialStatementsModule } from './financial-statements/financial-statements.module';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';
import { MaterialityModule } from './materiality/materiality.module';
import { ReportsModule } from './reports/reports.module';
import { SecurityModule } from './security/security.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';
import { WorkingPapersModule } from './working-papers/working-papers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: ['../.env', '.env'], validationSchema: envValidationSchema }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    // BullMQ is installed and configured when concrete queues are approved; no worker
    // connection is opened during the architecture phase.
    DatabaseModule, AuthModule, UsersModule, DashboardModule, ClientsModule, AuditPeriodsModule,
    ContractsModule, FinancialStatementsModule, MaterialityModule, WorkingPapersModule, ReportsModule,
    DocumentsModule, StorageModule, JobsModule, AuditLogModule, SecurityModule, HealthModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
