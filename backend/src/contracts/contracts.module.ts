import { OfficialContractDocument } from './documents/official-contract-document';
import { Module } from '@nestjs/common';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { ContractBatchService } from './contract-batch.service';
import { AmountToWordsService } from './variables/amount-to-words.service';
import { ContractContextBuilder } from './variables/contract-context.builder';
import { ContractTemplateRenderer } from './variables/contract-template.renderer';
import { ContractVariablesValidator } from './variables/contract-variables.validator';
import { ContractDocumentBuilder } from './documents/contract-document.builder';

@Module({
  imports: [AuditLogModule],
  controllers: [ContractsController],
  providers: [
    ContractsService,
    OfficialContractDocument,
    ContractBatchService,
    AmountToWordsService,
    ContractContextBuilder,
    ContractTemplateRenderer,
    ContractVariablesValidator,
    ContractDocumentBuilder,
  ],
  exports: [ContractsService],
})
export class ContractsModule {}
