import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import type { Request as ExpressRequest } from 'express';
import type { EntityManager } from 'typeorm';
import * as SYS_MSG from '@constants/system-messages';
import { IngestionService } from './ingestion.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { CreateRequestDocs } from './docs/ingestion-swagger.doc';
import { MAX_FILES_PER_REQUEST, MAX_UPLOAD_BYTES, type UploadedFile } from './ingestion.constants';

/** The RLS middleware attaches a per-request transactional manager (with app.org_id set) to the
 * Express request; intersect rather than replace so the standard request typings are preserved. */
type RlsRequest = ExpressRequest & { entityManager?: EntityManager };

@ApiTags('Requests')
@Controller('requests')
export class IngestionController {
  constructor(private readonly ingestion: IngestionService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  // Cap count AND per-file size at the multipart parser so Multer aborts an oversized stream instead
  // of buffering it fully into memory; the service still re-checks size as a friendly-message backstop.
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES_PER_REQUEST, {
      limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_FILES_PER_REQUEST },
    }),
  )
  @CreateRequestDocs()
  async create(
    @Body() dto: CreateRequestDto,
    @UploadedFiles() files: UploadedFile[] | undefined,
    @Req() req: RlsRequest,
  ) {
    const request = await this.ingestion.createRequest(dto, files ?? [], req.entityManager);
    return {
      statusCode: HttpStatus.ACCEPTED,
      message: SYS_MSG.REQUEST_CREATED,
      data: {
        request_id: request.id,
        status: request.status,
        current_node: request.current_node,
      },
    };
  }
}
