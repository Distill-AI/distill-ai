/**
 * Line-item flag written when a quote cannot be governed by pricing rules (US-E4-1 EC-02).
 * The scorer treats any non-`close_tie` flag as a review trigger, so a blocked quote never
 * auto-sends. US-E4-2 upgrades this to a confidence-independent hard gate in the score node.
 */
export const PRICING_BLOCKED_FLAG = 'pricing_blocked';
