import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AuditorsService } from './auditors.service';
import { AuditorListQuery, CreateAuditorDto, UpdateAuditorDto } from './dto/auditor.dto';
@ApiTags('auditors') @UseGuards(JwtAuthGuard,PermissionsGuard) @Controller('auditors')
export class AuditorsController { constructor(private readonly service:AuditorsService){} @Permissions('auditors.read') @Get() list(@CurrentUser() user:AuthenticatedUser,@Query() query:AuditorListQuery){return this.service.list(user.organizationId,query)} @Permissions('auditors.read') @Get(':id') one(@CurrentUser() user:AuthenticatedUser,@Param('id') id:string){return this.service.one(user.organizationId,id)} @Permissions('auditors.create') @Post() create(@CurrentUser() user:AuthenticatedUser,@Body() dto:CreateAuditorDto){return this.service.create(user.organizationId,dto)} @Permissions('auditors.update') @Patch(':id') update(@CurrentUser() user:AuthenticatedUser,@Param('id') id:string,@Body() dto:UpdateAuditorDto){return this.service.update(user.organizationId,id,dto)} @Permissions('auditors.delete') @Delete(':id') remove(@CurrentUser() user:AuthenticatedUser,@Param('id') id:string){return this.service.remove(user.organizationId,id)} }
