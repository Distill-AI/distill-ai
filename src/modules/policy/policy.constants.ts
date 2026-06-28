/**
 * Line-item flags written by the policy node (US-E4-2). The score node treats every flag in
 * HARD_REVIEW_FLAGS as a confidence-independent review trigger, so a breach routes the quote to
 * needs_review even when every line matched at 99% (the policy gate wins).
 */
export const MARGIN_FLOOR_BREACH_FLAG = 'margin_floor_breach';
export const MAX_DISCOUNT_BREACH_FLAG = 'max_discount_breach';
export const POLICY_BLOCKED_FLAG = 'policy_blocked';
