import { CurrentNode } from '../enums/current-node.enum';
import { ResumeReason } from '../enums/resume-reason.enum';

export interface RequestResumedEvent {
  type: 'request.resumed';
  timestamp: string;
  request_id: string;
  reason: ResumeReason;
  resumed_from_node: CurrentNode;
  resumed_at: string;
}

export interface ResumeResponsePayload {
  request_id: string;
  resumed: boolean;
  resume_reason: ResumeReason;
  current_node: CurrentNode | 'unknown';
}
