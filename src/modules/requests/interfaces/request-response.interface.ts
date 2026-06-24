import type { RequestType } from '../enums/request-type.enum';
import type { RequestStatus } from '../enums/request-status.enum';
import type { CurrentNode } from '../enums/current-node.enum';

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

/** Attachment metadata for the Review screen. Internal fields (storage_url, parsed_text) are omitted. */
export interface AttachmentSummary {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: Date;
}

/** Full request detail for the Review screen. Read model for `GET /requests/:id`. */
export interface RequestDetail extends RequestSummary {
  sender_email: string | null;
  source_body: string | null;
  current_node: CurrentNode;
  attachments: AttachmentSummary[];
}
