import { Body, Controller, Get, Param, Patch, Post, Query, Res, StreamableFile, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ContractsService } from './contracts.service';
import { ContractBatchService } from './contract-batch.service';
import { CreateContractDto, CreateTemplateDto, GenerateBatchDto, GenerateDocumentDto, UpdateContractDto, PrepareOfficialContractDto } from './dto/contracts.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/permissions.decorator';
import { AuthenticatedUser, CurrentUser } from '../auth/current-user.decorator';

@ApiTags('contracts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class ContractsController {
  constructor(
    private readonly service: ContractsService,
    private readonly batch: ContractBatchService,
  ) {}

  @Permissions('contracts.read')
  @Get('contract-templates')
  templates(@CurrentUser() user: AuthenticatedUser) {
    return this.service.templates(user.organizationId);
  }

  @Permissions('contracts.read')
  @Get('contract-templates/:id')
  template(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.template(user.organizationId, id);
  }

  @Permissions('contracts.create')
  @Post('contract-templates')
  createTemplate(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateTemplateDto) {
    return this.service.createTemplate(user.organizationId, dto);
  }

  @Permissions('contracts.read')
  @Get('contracts')
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.service.contracts(user.organizationId);
  }

  @Permissions('contracts.create')
  @Post('contracts')
  prepare(@CurrentUser() user: AuthenticatedUser, @Body() dto: PrepareOfficialContractDto) {
    return this.service.prepareOfficial(user.organizationId, user.id, dto);
  }

  @Permissions('contracts.read')
  @Get('contracts/:id')
  one(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.one(user.organizationId, id);
  }

  @Permissions('contracts.update')
  @Patch('contracts/:id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.service.updateContract(user.organizationId, user.id, id, dto);
  }

  @Permissions('contracts.create')
  @Post('audit-periods/:id/contracts')
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CreateContractDto,
  ) {
    return this.service.createContract(user.organizationId, user.id, id, dto);
  }

  @Permissions('contracts.read')
  @Get('audit-periods/:periodId/contract')
  byPeriod(@CurrentUser() user: AuthenticatedUser, @Param('periodId') periodId: string) {
    return this.service.contractByPeriod(user.organizationId, periodId);
  }

  @Permissions('contracts.read')
  @Get('contracts/:id/context')
  context(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.context(user.organizationId, id);
  }

  @Permissions('contracts.read')
  @Get('contracts/:id/variables/validate')
  validate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.validate(user.organizationId, id);
  }

  @Permissions('contracts.read')
  @Get('contracts/:id/preview')
  preview(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.preview(user.organizationId, id);
  }

  @Permissions('contracts.generate')
  @Post('contracts/generate-batch')
  generateBatch(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateBatchDto,
  ) {
    return this.batch.start(user.organizationId, user.id, dto.contractIds, dto.format);
  }

  @Permissions('contracts.generate')
  @Get('contracts/generate-batch/:jobId')
  batchStatus(@CurrentUser() user: AuthenticatedUser, @Param('jobId') jobId: string) {
    return this.batch.get(user.organizationId, jobId);
  }

  @Permissions('contracts.generate')
  @Post('contracts/:id/documents')
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GenerateDocumentDto,
  ) {
    return this.service.generate(user.organizationId, user.id, id, dto.format);
  }

  @Permissions('contracts.read')
  @Get('contracts/:id/documents')
  documents(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.documents(user.organizationId, id);
  }

  @Permissions('contracts.generate')
  @Get('contracts/:id/document/word')
  async documentWord(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.service.serveDocument(user.organizationId, user.id, id, 'docx');
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.buffer.length),
      'Content-Disposition': `attachment; filename="${file.fileName.replace(/["\r\n]/g, '')}"`,
    });
    return new StreamableFile(file.buffer);
  }

  @Permissions('contracts.generate')
  @Get('contracts/:id/document/pdf')
  async documentPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Query('mode') mode: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // mode=download → attachment (Descargar PDF); cualquier otro valor → inline (Ver documento).
    const download = mode === 'download';
    const file = await this.service.serveDocument(user.organizationId, user.id, id, 'pdf');
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.buffer.length),
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${file.fileName.replace(/["\r\n]/g, '')}"`,
    });
    return new StreamableFile(file.buffer);
  }

  @Permissions('contracts.read')
  @Get('contracts/:id/documents/:docId/download')
  async download(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('docId') docId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.service.download(user.organizationId, user.id, id, docId);
    res.set({
      'Content-Type': file.mimeType,
      'Content-Length': String(file.size),
      'Content-Disposition': `attachment; filename="${file.fileName.replace(/["\r\n]/g, '')}"`,
    });
    return file.stream;
  }
}
