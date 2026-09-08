import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { AuditorsController } from './auditors.controller';
import { AuditorsService } from './auditors.service';
@Module({imports:[AuditLogModule],controllers:[AuditorsController],providers:[AuditorsService]}) export class AuditorsModule {}
