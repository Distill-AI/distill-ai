import { RequestRouting } from '@modules/requests/enums/request-routing.enum';
import type { RoutingReason } from '@modules/requests/types/routing-reason';

export class ScoringResultDto {
  routing: RequestRouting;
  overallConfidence: number;
  routingReasons: RoutingReason[];
}
