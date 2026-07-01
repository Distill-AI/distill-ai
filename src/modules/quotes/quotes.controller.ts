import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { authConfig } from '@config/auth.config';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import { Roles } from '@modules/auth/decorators/roles.decorator';
import { Role } from '@modules/auth/enums/role.enum';
import type { AuthUser } from '@modules/auth/interfaces/auth-user.interface';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import * as SYS_MSG from '@constants/system-messages';
import { QuoteApprovalActions } from './actions/quote-approval.actions';
import { QuoteModelAction } from './quote.model-action';
import type { ApproveQuoteResponsePayload } from './interfaces/approve-quote.interface';
import { ApproveAndGenerateQuoteDocs, DownloadQuotePdfDocs } from './docs/quotes-swagger.doc';

@ApiTags('Quotes')
@Controller('requests')
export class QuotesController {
  constructor(
    private readonly approvalActions: QuoteApprovalActions,
    private readonly quotes: QuoteModelAction,
    private readonly requests: RequestModelAction,
    @Inject(OBJECT_STORE) private readonly objectStore: ObjectStore,
  ) {}

  /** Approves the request's priced quote, generates its PDF, and best-effort drafts a follow-up email. */
  @Post(':requestId/quote')
  @HttpCode(HttpStatus.OK)
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @ApproveAndGenerateQuoteDocs()
  async approveAndGenerate(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: { user?: AuthUser },
  ): Promise<{ statusCode: number; message: string; data: ApproveQuoteResponsePayload }> {
    await this.assertRequestInOrg(requestId, req.user);

    const data = await this.approvalActions.approveAndGenerate(
      requestId,
      req.user?.orgId,
      req.user?.userId,
    );

    return { statusCode: HttpStatus.OK, message: SYS_MSG.QUOTE_APPROVED_SUCCESS, data };
  }

  /** Streams the generated quote PDF; 404s when the quote has not been generated yet. */
  @Get(':requestId/quote/pdf')
  @Roles(Role.ESTIMATOR, Role.ADMIN)
  @DownloadQuotePdfDocs()
  async downloadPdf(
    @Param('requestId', ParseUUIDPipe) requestId: string,
    @Req() req: { user?: AuthUser },
    @Res() res: Response,
  ): Promise<void> {
    await this.assertRequestInOrg(requestId, req.user);

    const found = await this.quotes.getForRequest(requestId);
    if (!found || !found.quote.pdf_storage_url) {
      throw new CustomHttpException(SYS_MSG.QUOTE_PDF_NOT_READY(requestId), HttpStatus.NOT_FOUND);
    }

    const bytes = await this.objectStore.get(found.quote.pdf_storage_url);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', bytes.length);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(`${found.quote.quote_number}.pdf`)}`,
    );
    res.send(bytes);
  }

  /** Loads the request's org_id and, when auth is enabled, 404s (never 403) on any org mismatch, so cross-org existence is not leaked. */
  private async assertRequestInOrg(requestId: string, user?: AuthUser): Promise<void> {
    const request = await this.requests.get({ identifierOptions: { id: requestId } });
    if (!request) {
      throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
    }
    if (authConfig.enabled) {
      if (!user || request.org_id !== user.orgId) {
        throw new NotFoundException(SYS_MSG.REQUEST_NOT_FOUND(requestId));
      }
    }
  }
}
