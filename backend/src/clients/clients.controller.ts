import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto, ClientListQuery } from './dto/client.dto';
import { CreateRepresentativeDto, UpdateRepresentativeDto } from './dto/representative.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'; import { PermissionsGuard } from '../auth/guards/permissions.guard'; import { Permissions } from '../auth/permissions.decorator'; import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';
@ApiTags('clients') @UseGuards(JwtAuthGuard, PermissionsGuard) @Controller('clients')
export class ClientsController {
  constructor(private readonly service: ClientsService) {}
  @Permissions('clients.read') @Get() findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: ClientListQuery) { return query.page !== undefined || query.pageSize !== undefined || query.search !== undefined ? this.service.listPage(user.organizationId, query) : this.service.findAll(user.organizationId); }
  @Permissions('clients.read') @Get(':id') findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.findOne(user.organizationId, id); }
  @Permissions('clients.create') @Post() create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateClientDto) { return this.service.create(user.organizationId, dto); }
  @Permissions('clients.update') @Patch(':id') update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: UpdateClientDto) { return this.service.update(user.organizationId, id, dto); }
  @Permissions('clients.delete') @Delete(':id') remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.service.remove(user.organizationId, id); }
  @Permissions('clients.read') @Get(':clientId/representatives') reps(@CurrentUser() user: AuthenticatedUser, @Param('clientId') id: string) { return this.service.findOne(user.organizationId, id).then(() => this.service.representatives(id)); }
  @Permissions('clients.update') @Post(':clientId/representatives') createRep(@CurrentUser() user: AuthenticatedUser, @Param('clientId') id: string, @Body() dto: CreateRepresentativeDto) { return this.service.createRepresentative(user.organizationId, id, dto); }
  @Permissions('clients.update') @Patch(':clientId/representatives/:representativeId') updateRep(@CurrentUser() user: AuthenticatedUser, @Param('clientId') clientId: string, @Param('representativeId') representativeId: string, @Body() dto: UpdateRepresentativeDto) { return this.service.updateRepresentative(user.organizationId, clientId, representativeId, dto); }
}

