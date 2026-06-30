import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { authConfig } from '@config/auth.config';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { Roles } from '@modules/auth';
import { Role } from '@modules/auth/enums/role.enum';
import * as SYS_MSG from '@constants/system-messages';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { ClarificationService } from './clarification.service';
import { GenerateDraftDto, UpdateDraftDto } from './dto/clarification.dto';
import {
  GenerateDraftDocs,
  GetClarificationDocs,
  UpdateDraftDocs,
  SendClarificationDocs,
} from './docs/clarification-swagger.doc';

@ApiTags('Clarification')
@Controller()
export class ClarificationController {
  constructor(private readonly clarificationService: ClarificationService) {}

  @Post('requests/:requestId/clarifications/draft')
  @HttpCode(HttpStatus.CREATED)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @GenerateDraftDocs()
  async generateDraft(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: GenerateDraftDto,
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    let callerOrgId: string | undefined;
    if (authConfig.enabled) {
      const user = req.user;
      if (!user?.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
      callerOrgId = user.orgId;
    }

    const result = await this.clarificationService.generateDraft(requestId, dto.gaps, callerOrgId);
    return {
      statusCode: HttpStatus.CREATED,
      message: SYS_MSG.CLARIFICATION_DRAFT_GENERATED,
      data: result,
    };
  }

  @Get('requests/:requestId/clarifications')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @GetClarificationDocs()
  async getClarification(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    let callerOrgId: string | undefined;
    if (authConfig.enabled) {
      const user = req.user;
      if (!user?.orgId) {
        throw new NotFoundException(SYS_MSG.CLARIFICATION_NOT_FOUND);
      }
      callerOrgId = user.orgId;
    }

    const result = await this.clarificationService.getByRequestId(requestId, callerOrgId);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.CLARIFICATION_RETRIEVED,
      data: result,
    };
  }

  @Put('clarifications/:id/draft')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @UpdateDraftDocs()
  async updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDraftDto,
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    let callerOrgId: string | undefined;
    if (authConfig.enabled) {
      const user = req.user;
      if (!user?.orgId) {
        throw new CustomHttpException(SYS_MSG.CLARIFICATION_NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      callerOrgId = user.orgId;
    }

    const result = await this.clarificationService.updateDraft(
      id,
      dto.draft_subject,
      dto.draft_body,
      callerOrgId,
    );
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.CLARIFICATION_DRAFT_UPDATED,
      data: result,
    };
  }

  @Post('clarifications/:id/send')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @SendClarificationDocs()
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    let sentBy: string | undefined;
    let callerOrgId: string | undefined;
    if (authConfig.enabled) {
      const user = req.user;
      if (!user) {
        throw new CustomHttpException(SYS_MSG.AUTH_UNAUTHORIZED, HttpStatus.UNAUTHORIZED);
      }
      if (!user.orgId) {
        throw new CustomHttpException(SYS_MSG.AUTH_FORBIDDEN, HttpStatus.FORBIDDEN);
      }
      callerOrgId = user.orgId;
      sentBy = user.userId;
    }

    const result = await this.clarificationService.send(id, sentBy, callerOrgId);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.CLARIFICATION_SENT,
      data: result,
    };
  }
}
