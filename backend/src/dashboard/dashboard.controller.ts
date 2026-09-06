import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthenticatedUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { DashboardService } from './dashboard.service';
@ApiTags('dashboard') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('dashboard') export class DashboardController { constructor(private readonly service: DashboardService) {} @Permissions('clients.read') @Get('summary') summary(@CurrentUser() user: AuthenticatedUser) { return this.service.summary(user.organizationId); } }
