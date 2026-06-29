import { RequestStatus } from '../enums/request-status.enum';

export interface DeclineResponsePayload {
  request_id: string;
  status: RequestStatus;
  reason: string;
}
