import type { RequestType } from '../enums/request-type.enum';
import type { RequestStatus } from '../enums/request-status.enum';
import type { CurrentNode } from '../enums/current-node.enum';
import type { ParseStatus } from '../enums/parse-status.enum';
import type { ParseErrorReason } from '../enums/parse-error-reason.enum';
import type { RequestRouting } from '../enums/request-routing.enum';
import type { RoutingReason } from '../types/routing-reason';

/** A request as it appears in the Inbox list. Read model for `GET /requests`. */
export interface RequestSummary {
  id: string;
  sender_company: string | null;
  sender_contact: string | null;
  source_subject: string | null;
  request_type: RequestType;
  overall_confidence: number | null;
  status: RequestStatus;
  created_at: Date;
}

/** Attachment metadata for the Review screen; parse fields drive the paste-fallback UX. Internal fields (storage_url, parsed_text, raw_text) are omitted. */
export interface AttachmentSummary {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  parse_status: ParseStatus;
  parse_error_reason: ParseErrorReason | null;
  created_at: Date;
}

/** Full request detail for the Review screen. Read model for `GET /requests/:id`. */
export interface RequestDetail extends RequestSummary {
  sender_email: string | null;
  source_body: string | null;
  current_node: CurrentNode;
  routing: RequestRouting | null;
  routing_reasons: RoutingReason[];
  attachments: AttachmentSummary[];
}
