import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { ClarificationService } from './clarification.service';
import { GenerateDraftDto, UpdateDraftDto, SendClarificationDto } from './dto/clarification.dto';
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
  @GenerateDraftDocs()
  async generateDraft(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Body() dto: GenerateDraftDto,
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    const result = await this.clarificationService.generateDraft(requestId, dto.gaps);
    return {
      statusCode: HttpStatus.CREATED,
      message: SYS_MSG.CLARIFICATION_DRAFT_GENERATED,
      data: result,
    };
  }

  @Get('requests/:requestId/clarifications')
  @HttpCode(HttpStatus.OK)
  @GetClarificationDocs()
  async getClarification(
    @Param('requestId', ParseUUIDPipe) requestId: string,
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    const result = await this.clarificationService.getByRequestId(requestId);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.CLARIFICATION_RETRIEVED,
      data: result,
    };
  }

  @Put('clarifications/:id/draft')
  @HttpCode(HttpStatus.OK)
  @UpdateDraftDocs()
  async updateDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDraftDto,
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    const result = await this.clarificationService.updateDraft(
      id,
      dto.draft_subject,
      dto.draft_body,
    );
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.CLARIFICATION_DRAFT_UPDATED,
      data: result,
    };
  }

  @Post('clarifications/:id/send')
  @HttpCode(HttpStatus.OK)
  @SendClarificationDocs()
  async send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendClarificationDto,
  ): Promise<{ statusCode: number; message: string; data: unknown }> {
    const result = await this.clarificationService.send(id, dto.sent_by);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.CLARIFICATION_SENT,
      data: result,
    };
  }
}
