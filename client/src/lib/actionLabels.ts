/** Single source of truth for the primary-action labels (Review, Quote Output).
 * None may imply a real outbound send: neither action has a mailer behind it. */
export const PRIMARY_ACTION_LABELS = {
  reviewApprove: 'Approve & generate',
  quoteApprove: 'Approve & ready',
} as const;
