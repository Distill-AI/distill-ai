import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Quote } from './entities/quote.entity';
import { QuoteLineItem } from './entities/quote-line-item.entity';
import { QuoteModelAction } from './quote.model-action';

/** Persistence for priced quotes. Exports QuoteModelAction for the price node (US-E4-1). */
@Module({
  imports: [TypeOrmModule.forFeature([Quote, QuoteLineItem])],
  providers: [QuoteModelAction],
  exports: [QuoteModelAction],
})
export class QuotesModule {}
