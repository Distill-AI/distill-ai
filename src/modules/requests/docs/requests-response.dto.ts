import { ApiProperty } from '@nestjs/swagger';
import { RequestType } from '../enums/request-type.enum';
import { RequestStatus } from '../enums/request-status.enum';
import { CurrentNode } from '../enums/current-node.enum';
import { ParseStatus } from '../enums/parse-status.enum';
import { ParseErrorReason } from '../enums/parse-error-reason.enum';
import { RequestRouting } from '../enums/request-routing.enum';

/** Swagger schema for an Inbox list row (GET /requests). Documentation only. */
export class RequestSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ nullable: true, example: 'Apex Fabrication' })
  sender_company: string | null;

  @ApiProperty({ nullable: true, example: 'Dana Reyes' })
  sender_contact: string | null;

  @ApiProperty({ nullable: true, example: 'RFQ: 200x steel brackets' })
  source_subject: string | null;

  @ApiProperty({ enum: RequestType, example: RequestType.CATALOG_RFQ })
  request_type: RequestType;

  @ApiProperty({ nullable: true, example: 0.96 })
  overall_confidence: number | null;

  @ApiProperty({ enum: RequestStatus, example: RequestStatus.NEEDS_REVIEW })
  status: RequestStatus;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: Date;
}

/** Swagger schema for attachment metadata in the request detail. Internal fields are omitted. */
export class AttachmentSummaryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'rfq_apex.pdf' })
  filename: string;

  @ApiProperty({ example: 'application/pdf' })
  mime_type: string;

  @ApiProperty({ example: 1258291 })
  size_bytes: number;

  @ApiProperty({ enum: ParseStatus, example: ParseStatus.UNPARSED })
  parse_status: ParseStatus;

  @ApiProperty({ enum: ParseErrorReason, nullable: true })
  parse_error_reason: ParseErrorReason | null;

  @ApiProperty({ type: String, format: 'date-time' })
  created_at: Date;
}

/** Swagger schema for the full request detail (GET /requests/:id). Documentation only. */
export class RequestDetailResponseDto extends RequestSummaryResponseDto {
  @ApiProperty({ nullable: true, example: 'dana@apex.example' })
  sender_email: string | null;

  @ApiProperty({ nullable: true, example: 'Hi, please quote 200 steel brackets...' })
  source_body: string | null;

  @ApiProperty({ enum: CurrentNode, example: CurrentNode.EXTRACT })
  current_node: CurrentNode;

  @ApiProperty({ enum: RequestRouting, nullable: true, example: RequestRouting.NEEDS_REVIEW })
  routing: RequestRouting | null;

  @ApiProperty({
    type: 'array',
    items: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'low_line_confidence' },
        message: { type: 'string', example: 'Line confidence 0.64 below auto threshold 0.95' },
        source: { type: 'string', example: 'confidence' },
      },
    },
  })
  routing_reasons: Array<{ code: string; message: string; source: string }>;

  @ApiProperty({ type: [AttachmentSummaryResponseDto] })
  attachments: AttachmentSummaryResponseDto[];
}
