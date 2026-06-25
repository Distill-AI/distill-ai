import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { PricingService } from './pricing.service';
import { EvaluatePriceDto } from './dto/pricing.dto';
import type { PricingRulesConfig, PriceEvaluationResult } from './pricing.service';
import {
  EvaluatePriceDocs,
  GetPricingRulesDocs,
  ReloadPricingRulesDocs,
} from './docs/pricing-swagger.doc';

@ApiTags('Pricing')
@Controller('pricing')
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('rules')
  @GetPricingRulesDocs()
  async getRules(): Promise<{
    statusCode: number;
    message: string;
    data: PricingRulesConfig;
  }> {
    const rules = await this.pricingService.getRules();
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.PRICING_RULES_RETRIEVED,
      data: rules,
    };
  }

  @Post('reload')
  @HttpCode(HttpStatus.OK)
  @ReloadPricingRulesDocs()
  async reload(): Promise<{
    statusCode: number;
    message: string;
    data: PricingRulesConfig;
  }> {
    try {
      const rules = await this.pricingService.reload();
      return {
        statusCode: HttpStatus.OK,
        message: SYS_MSG.PRICING_RULES_RELOADED,
        data: rules,
      };
    } catch {
      throw new HttpException(
        {
          statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          message: SYS_MSG.PRICING_RULES_INVALID('Config validation failed'),
          data: await this.pricingService.getRules(),
        },
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @EvaluatePriceDocs()
  async evaluate(@Body() dto: EvaluatePriceDto): Promise<{
    statusCode: number;
    message: string;
    data: PriceEvaluationResult;
  }> {
    const result = await this.pricingService.evaluate(dto);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.PRICING_EVALUATED,
      data: result,
    };
  }
}
