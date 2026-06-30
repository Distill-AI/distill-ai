import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineItem } from '@modules/catalog/entities/line-item.entity';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import { QuotesModule } from '@modules/quotes/quotes.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { QuotePricingService } from './quote-pricing.service';
import { QuoteRecomputeService } from './quote-recompute.service';
import { PricingRuleModelAction } from './pricing-rule.model-action';
import { PricingRule } from './entities/pricing-rule.entity';

// LineItemModelAction is provided here (not imported from ExtractionModule) and kept internal, so
// QuoteRecomputeService can read line items without pulling the extraction graph or exporting a
// second LineItemModelAction token to consumers of PricingModule.
@Module({
  imports: [TypeOrmModule.forFeature([PricingRule, LineItem]), QuotesModule],
  controllers: [PricingController],
  providers: [
    PricingService,
    QuotePricingService,
    QuoteRecomputeService,
    PricingRuleModelAction,
    LineItemModelAction,
  ],
  exports: [PricingService, QuotePricingService, QuoteRecomputeService, PricingRuleModelAction],
})
export class PricingModule {}
