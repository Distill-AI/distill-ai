import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LLMModule } from '@modules/llm/llm.module';
import { ToolsModule } from '@modules/tools/tools.module';
import { ToolRegistry } from '@modules/tools/registry';
import { RequestsDataModule } from '@modules/requests/requests-data.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { Extraction } from './entities/extraction.entity';
import { ExtractionActions } from './actions/extraction.actions';
import { ExtractionModelAction } from './extraction.model-action';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import { ExtractRequestToolFactory } from './tools/extract-request.tool';

@Module({
  imports: [
    LLMModule,
    ToolsModule,
    RequestsDataModule,
    // CatalogModule owns the catalog entity registration so the worker graph also gets it via PipelineQueueModule.
    CatalogModule,
    TypeOrmModule.forFeature([Extraction]),
  ],
  providers: [
    ExtractionModelAction,
    ExtractionActions,
    LineItemModelAction,
    ExtractRequestToolFactory,
  ],
  exports: [
    ExtractionModelAction,
    ExtractionActions,
    LineItemModelAction,
    ExtractRequestToolFactory,
  ],
})
export class ExtractionModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly extractRequestToolFactory: ExtractRequestToolFactory,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.extractRequestToolFactory.create());
  }
}
