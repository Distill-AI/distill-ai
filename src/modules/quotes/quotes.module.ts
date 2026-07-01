import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ObjectStoreModule } from '@common/object-store/object-store.module';
import { LLMModule } from '@modules/llm/llm.module';
import { ToolsModule } from '@modules/tools/tools.module';
import { ToolRegistry } from '@modules/tools/registry';
import { RequestsDataModule } from '@modules/requests/requests-data.module';
import { Quote } from './entities/quote.entity';
import { QuoteLineItem } from './entities/quote-line-item.entity';
import { QuoteModelAction } from './quote.model-action';
import { QuotePdfRenderer } from './services/quote-pdf-renderer.service';
import { RenderQuotePdfToolFactory } from './tools/render-quote-pdf.tool';
import { DraftQuoteEmailToolFactory } from './tools/draft-quote-email.tool';

/** Persistence for priced quotes. Exports QuoteModelAction for the price node (US-E4-1). */
@Module({
  imports: [
    TypeOrmModule.forFeature([Quote, QuoteLineItem]),
    ObjectStoreModule,
    LLMModule,
    ToolsModule,
    RequestsDataModule,
  ],
  providers: [
    QuoteModelAction,
    QuotePdfRenderer,
    RenderQuotePdfToolFactory,
    DraftQuoteEmailToolFactory,
  ],
  exports: [QuoteModelAction],
})
export class QuotesModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly renderQuotePdfFactory: RenderQuotePdfToolFactory,
    private readonly draftQuoteEmailFactory: DraftQuoteEmailToolFactory,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.renderQuotePdfFactory.create());
    this.registry.register(this.draftQuoteEmailFactory.create());
  }
}
