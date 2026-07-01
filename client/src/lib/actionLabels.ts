/** Single source of truth for the three primary-action labels (Review, Clarification, Quote Output).
 * None may imply a real outbound send: none of these actions has a mailer behind it. */
export const PRIMARY_ACTION_LABELS = {
  reviewApprove: 'Approve & generate',
  clarificationSend: 'Mark as sent',
  quoteApprove: 'Approve & ready',
} as const;
