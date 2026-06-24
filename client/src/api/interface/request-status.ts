// Mirrors the backend RequestStatus / RequestType enums (src/modules/requests/enums).
export type RequestStatus =
  | 'received'
  | 'parsing'
  | 'needs_review'
  | 'priced'
  | 'ready'
  | 'sent'
  | 'declined'
  | 'needs_clarification'
  | 'failed';

export type RequestType = 'catalog_rfq' | 'service_quote' | 'unknown';

export const requestStatusLabels: Record<RequestStatus, string> = {
  received: 'Received',
  parsing: 'Parsing',
  needs_review: 'Needs review',
  priced: 'Priced',
  ready: 'Ready',
  sent: 'Sent',
  declined: 'Declined',
  needs_clarification: 'Needs clarification',
  failed: 'Failed',
};

/** Runtime guard: true when `value` is one of the known RequestStatus values. */
export function isRequestStatus(value: string): value is RequestStatus {
  return Object.prototype.hasOwnProperty.call(requestStatusLabels, value);
}

export const requestTypeLabels: Record<RequestType, string> = {
  catalog_rfq: 'Catalog RFQ',
  service_quote: 'Service Quote',
  unknown: 'Unknown',
};
