import { Controller, Get, Param, Patch, Body, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { IsString } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';
import { Permissions } from '../../auth/permissions.decorator';
import { AuthenticatedUser, CurrentUser } from '../../auth/current-user.decorator';
import { FinancialImportService } from './financial-import.service';
import { FinancialProcessingService } from './financial-processing.service';
import { FinancialReclassificationService } from './financial-reclassification.service';
import { CANONICAL_KEYS } from '../normalization/statement-normalizer.service';
import { EXCEL_LIMITS } from '../parsers/excel-parser.service';

export class ReclassifyLineDto {
  @IsString()
  normalizedKey!: string;
}

@ApiTags('financial-imports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class FinancialImportsController {
  constructor(
    private readonly imports: FinancialImportService,
    private readonly processing: FinancialProcessingService,
    private readonly reclassification: FinancialReclassificationService,
  ) {}

  @Permissions('financial.import')
  @Post('financial-imports/preview')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: EXCEL_LIMITS.maxFileBytes, files: 1 } }))
  preview(@UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer }) {
    return this.imports.preview(file);
  }

  @Permissions('financial.import')
  @Post('audit-periods/:id/financial-imports')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: EXCEL_LIMITS.maxFileBytes, files: 1 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() file: { originalname: string; mimetype: string; size: number; buffer: Buffer },
  ) {
    return this.imports.upload(user.organizationId, user.id, id, file);
  }

  @Permissions('financial.read')
  @Get('audit-periods/:id/financial-imports')
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.imports.list(user.organizationId, id);
  }

  @Permissions('financial.read')
  @Get('financial-imports/:id')
  one(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.imports.one(user.organizationId, id);
  }

  @Permissions('financial.import')
  @Post('financial-imports/:id/process')
  process(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.processing.process(user.organizationId, user.id, id);
  }

  @Permissions('financial.read')
  @Get('financial-imports/:id/statements')
  statements(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.imports.statements(user.organizationId, id);
  }

  @Permissions('financial.read')
  @Get('financial-statement-keys')
  catalog() {
    return CANONICAL_KEYS;
  }

  @Permissions('financial.update')
  @Patch('financial-statement-lines/:id/classification')
  reclassify(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReclassifyLineDto,
  ) {
    return this.reclassification.reclassify(user.organizationId, user.id, id, dto.normalizedKey);
  }
}
