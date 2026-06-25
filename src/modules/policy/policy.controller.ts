import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { PolicyService } from './policy.service';
import { EvaluatePolicyDto, ReloadPolicyRulesDto } from './dto/policy.dto';
import type { PolicyRulesConfig, PolicyEvaluationResult } from './policy.service';
import {
  EvaluatePolicyDocs,
  GetPolicyRulesDocs,
  ReloadPolicyRulesDocs,
} from './docs/policy-swagger.doc';

@ApiTags('Policy')
@Controller('policy')
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get('rules')
  @GetPolicyRulesDocs()
  async getRules(): Promise<{
    statusCode: number;
    message: string;
    data: PolicyRulesConfig;
  }> {
    const rules = await this.policyService.getRules();
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.POLICY_RULES_RETRIEVED,
      data: rules,
    };
  }

  @Post('reload')
  @HttpCode(HttpStatus.OK)
  @ReloadPolicyRulesDocs()
  async reload(@Body() dto: ReloadPolicyRulesDto): Promise<{
    statusCode: number;
    message: string;
    data: PolicyRulesConfig;
  }> {
    try {
      const rules = await this.policyService.reload(dto.configPath);
      return {
        statusCode: HttpStatus.OK,
        message: SYS_MSG.POLICY_RULES_RELOADED,
        data: rules,
      };
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      return {
        statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
        message: SYS_MSG.POLICY_RULES_INVALID(detail),
        data: await this.policyService.getRules(),
      };
    }
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @EvaluatePolicyDocs()
  async evaluate(@Body() dto: EvaluatePolicyDto): Promise<{
    statusCode: number;
    message: string;
    data: PolicyEvaluationResult;
  }> {
    const result = await this.policyService.evaluate(dto);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.POLICY_EVALUATED,
      data: result,
    };
  }
}
