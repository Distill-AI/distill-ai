export interface Clarification {
  id: string;
  request_id: string;
  gaps: string[];
  draft_subject: string | null;
  draft_body: string | null;
  sent_at: string | null;
  sent_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpdateDraftPayload {
  draft_subject?: string;
  draft_body?: string;
}

export interface SendResult {
  id: string;
  sent_at: string;
  sent_by: string;
}
