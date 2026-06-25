import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { PolicyService } from './policy.service';
import { EvaluatePolicyDto } from './dto/policy.dto';
import type { PolicyRulesConfig, PolicyEvaluationResult } from './policy.service';
import {
  EvaluatePolicyDocs,
  GetPolicyRulesDocs,
  ReloadPolicyRulesDocs,
} from './docs/policy-swagger.doc';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';

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
  async reload(): Promise<{
    statusCode: number;
    message: string;
    data: PolicyRulesConfig;
  }> {
    try {
      const rules = await this.policyService.reload();
      return {
        statusCode: HttpStatus.OK,
        message: SYS_MSG.POLICY_RULES_RELOADED,
        data: rules,
      };
    } catch (err) {
      const isNotFound = (err as NodeJS.ErrnoException).code === 'ENOENT';
      throw new CustomHttpException(
        isNotFound
          ? SYS_MSG.POLICY_RULES_FILE_NOT_FOUND('policy-rules.json')
          : SYS_MSG.POLICY_CONFIG_VALIDATION_FAILED,
        isNotFound ? HttpStatus.NOT_FOUND : HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
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
