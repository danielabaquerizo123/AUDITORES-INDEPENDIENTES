import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: { organizationId: string; actorUserId?: string; action: string; entityType: string; entityId: string; auditPeriodId?: string; before?: Prisma.InputJsonValue; after?: Prisma.InputJsonValue }) {
    await this.prisma.auditLog.create({ data: input });
  }
}
