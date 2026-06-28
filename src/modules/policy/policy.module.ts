import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PricingRule } from '@modules/pricing/entities/pricing-rule.entity';
import { PolicyService } from './policy.service';
import { PolicyController } from './policy.controller';
import { QuotePolicyService } from './quote-policy.service';
import { PolicyRuleModelAction } from './policy-rule.model-action';

@Module({
  imports: [TypeOrmModule.forFeature([PricingRule])],
  controllers: [PolicyController],
  providers: [PolicyService, QuotePolicyService, PolicyRuleModelAction],
  exports: [PolicyService, QuotePolicyService, PolicyRuleModelAction],
})
export class PolicyModule {}
