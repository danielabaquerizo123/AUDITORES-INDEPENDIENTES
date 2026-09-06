import { Module } from '@nestjs/common';
import { AuditPeriodsController } from './audit-periods.controller'; import { AuditPeriodsService } from './audit-periods.service';
@Module({controllers:[AuditPeriodsController],providers:[AuditPeriodsService]})
export class AuditPeriodsModule {}
