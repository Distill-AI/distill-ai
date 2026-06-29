import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';
import { QuotePricingService } from './quote-pricing.service';
import { PricingRuleModelAction } from './pricing-rule.model-action';
import { PricingRule } from './entities/pricing-rule.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule])],
  controllers: [PricingController],
  providers: [PricingService, QuotePricingService, PricingRuleModelAction],
  exports: [PricingService, QuotePricingService, PricingRuleModelAction],
})
export class PricingModule {}
