export interface DraftClarificationInput {
  gaps: string[];
  requestId: string;
}

export interface DraftClarificationOutput {
  draft_subject: string;
  draft_body: string;
}

export interface SendClarificationPayload {
  clarificationId: string;
  sentBy: string;
}

export interface UpdateDraftPayload {
  draft_subject?: string;
  draft_body?: string;
}
