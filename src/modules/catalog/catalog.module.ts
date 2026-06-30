import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolsModule } from '@modules/tools/tools.module';
import { ToolRegistry } from '@modules/tools/registry';
import { LineItem } from './entities/line-item.entity';
import { Sku } from './entities/sku.entity';
import { CandidateMatch } from './entities/candidate-match.entity';
import { EmbeddingsClientService } from './embeddings-client.service';
import { CandidateMatchModelAction } from './candidate-match.model-action';
import { SearchCatalogToolFactory } from './tools/search-catalog.tool';
import { SkuSearchActions } from './actions/sku-search.actions';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';

// LineItem is included so the LineItem -> Sku relation resolves under autoLoadEntities.
// Sku relates to Organization, registered in RequestsDataModule (in the import graph alongside this).
@Module({
  imports: [ToolsModule, TypeOrmModule.forFeature([LineItem, Sku, CandidateMatch])],
  controllers: [CatalogController],
  providers: [
    EmbeddingsClientService,
    SkuSearchActions,
    SearchCatalogToolFactory,
    CandidateMatchModelAction,
    CatalogService,
  ],
  exports: [
    TypeOrmModule,
    EmbeddingsClientService,
    SkuSearchActions,
    SearchCatalogToolFactory,
    CandidateMatchModelAction,
    CatalogService,
  ],
})
export class CatalogModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly factory: SearchCatalogToolFactory,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.factory.create());
  }
}
