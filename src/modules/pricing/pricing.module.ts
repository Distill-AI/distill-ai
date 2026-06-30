import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesModule } from '@modules/quotes/quotes.module';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { QuotePricingService } from './quote-pricing.service';
import { QuoteRecomputeService } from './quote-recompute.service';
import { PricingRuleModelAction } from './pricing-rule.model-action';
import { PricingRule } from './entities/pricing-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule]), QuotesModule],
  controllers: [PricingController],
  providers: [PricingService, QuotePricingService, QuoteRecomputeService, PricingRuleModelAction],
  exports: [PricingService, QuotePricingService, QuoteRecomputeService, PricingRuleModelAction],
})
export class PricingModule {}
