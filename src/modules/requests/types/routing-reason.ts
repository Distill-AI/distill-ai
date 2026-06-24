/** Structured entry persisted on `requests.routing_reasons` for human review. */
export interface RoutingReason {
  code: string;
  message: string;
  source: 'extraction' | 'confidence';
}
