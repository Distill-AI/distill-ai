import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { AnyTransactionOptions } from '@common/model-action/abstract.model-action';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import { OBJECT_STORE, type ObjectStore } from '@common/object-store/object-store.port';
import { RequestModelAction } from '@modules/requests/requests.model-action';
import { AttachmentModelAction } from '@modules/requests/attachments.model-action';
import { Request } from '@modules/requests/entities/request.entity';
import { RequestChannel } from '@modules/requests/enums/request-channel.enum';
import { RequestStatus } from '@modules/requests/enums/request-status.enum';
import { CurrentNode } from '@modules/requests/enums/current-node.enum';
import { PipelineRunner } from '@modules/pipeline/pipeline.runner';
import * as SYS_MSG from '@constants/system-messages';
import {
  ALLOWED_TYPES,
  DEMO_ORG_ID,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_MB,
  type UploadedFile,
} from './ingestion.constants';
import { CreateRequestDto } from './dto/create-request.dto';

/** Orchestrates request intake: validate input, persist the request + attachments, store the
 * original bytes, and enqueue the pipeline. */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly requests: RequestModelAction,
    private readonly attachments: AttachmentModelAction,
    @Inject(OBJECT_STORE) private readonly store: ObjectStore,
    private readonly runner: PipelineRunner,
  ) {}

  /**
   * Create a request from an upload or a paste, persist its attachments, and enqueue processing.
   * Writes go through the request-scoped `entityManager` (when present) so the org_id RLS policy is
   * satisfied; the same manager makes the request + attachment inserts one unit of work.
   */
  async createRequest(
    dto: CreateRequestDto,
    files: UploadedFile[],
    entityManager?: EntityManager,
  ): Promise<Request> {
    this.validateFiles(files);
    this.ensureHasInput(dto, files);
    const channel = this.resolveChannel(dto, files);
    const orgId = await this.currentOrgId(entityManager);
    const tx: AnyTransactionOptions = entityManager
      ? { useTransaction: true, transaction: entityManager }
      : { useTransaction: false };

    const request = await this.requests.create({
      createPayload: {
        org_id: orgId,
        channel,
        status: RequestStatus.PARSING,
        current_node: CurrentNode.PARSE,
        // processing_started_at is stamped by the engine's markProcessing() when the run actually
        // starts; setting it at intake would misrepresent the start time and double-write.
        source_subject: dto.source_subject ?? null,
        source_body: dto.source_body ?? null,
        sender_company: dto.sender_company ?? null,
        sender_contact: dto.sender_contact ?? null,
        sender_email: dto.sender_email ?? null,
      },
      transactionOptions: tx,
    });

    for (const file of files) {
      const key = `attachments/${request.id}/${randomUUID()}-${sanitizeFilename(file.originalname)}`;
      const storageUrl = await this.store.put(key, file.buffer);
      await this.attachments.create({
        createPayload: {
          request_id: request.id,
          filename: file.originalname,
          mime_type: file.mimetype,
          size_bytes: file.size,
          storage_url: storageUrl,
        },
        transactionOptions: tx,
      });
    }

    await this.runner.enqueue(request.id);
    this.logger.log({
      event: 'request_created',
      request_id: request.id,
      channel,
      attachments: files.length,
    });
    return request;
  }

  /** Reject any file outside the pdf/csv/txt allowlist or over the size cap. The declared mime is
   * checked AS A PAIR with the extension (see ALLOWED_TYPES), so a renamed file (e.g. .txt carrying
   * application/pdf) is rejected, not just an unknown extension. */
  private validateFiles(files: UploadedFile[]): void {
    for (const file of files) {
      const ext = extname(file.originalname).toLowerCase();
      const allowedMimes = ALLOWED_TYPES[ext];
      if (!allowedMimes || !allowedMimes.has(file.mimetype)) {
        throw new CustomHttpException(SYS_MSG.UNSUPPORTED_FILE_TYPE, HttpStatus.BAD_REQUEST);
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new CustomHttpException(
          SYS_MSG.FILE_TOO_LARGE(MAX_UPLOAD_MB),
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  /** A request needs either at least one file or non-empty pasted text. */
  private ensureHasInput(dto: CreateRequestDto, files: UploadedFile[]): void {
    if (files.length === 0 && !dto.source_body?.trim()) {
      throw new CustomHttpException(SYS_MSG.REQUEST_INPUT_REQUIRED, HttpStatus.BAD_REQUEST);
    }
  }

  /** Channel is derived from what was actually submitted so it cannot contradict the payload:
   * any files -> upload; otherwise the caller's channel (email/form) or email by default. A client
   * sending files with channel=email no longer persists a mode-inconsistent row. */
  private resolveChannel(dto: CreateRequestDto, files: UploadedFile[]): RequestChannel {
    if (files.length > 0) return RequestChannel.UPLOAD;
    return dto.channel ?? RequestChannel.EMAIL;
  }

  /** The org_id the RLS session is scoped to, read from the same connection that will do the insert
   * so the value always matches the `insert_by_org` WITH CHECK. When an EntityManager is present the
   * RLS middleware must have set app.org_id (the nil UUID even in demo mode); an empty value there is
   * a misconfiguration and we fail fast rather than risk writing into the wrong tenant. The demo org
   * fallback applies only when there is no request-scoped manager at all. */
  private async currentOrgId(entityManager?: EntityManager): Promise<string> {
    if (!entityManager) {
      return DEMO_ORG_ID;
    }
    const rows = (await entityManager.query(
      "SELECT current_setting('app.org_id', true) AS org_id",
    )) as Array<{ org_id: string | null }>;
    const orgId = rows[0]?.org_id;
    if (!orgId) {
      throw new CustomHttpException(SYS_MSG.RLS_CONTEXT_MISSING, HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return orgId;
  }
}

/** Strip directory separators and unusual characters from an uploaded name before using it in a
 * storage key, so a crafted filename cannot influence the path. */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]/g, '_')
    .replace(/[^\w.-]/g, '_')
    .slice(0, 120);
}
