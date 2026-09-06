import { Module } from '@nestjs/common';
import { ClientsController } from './clients.controller';
import { ClientsService } from './clients.service';
import { AuditLogModule } from '../audit-log/audit-log.module';
@Module({ imports: [AuditLogModule], controllers: [ClientsController], providers: [ClientsService], exports: [ClientsService] })
export class ClientsModule {}
