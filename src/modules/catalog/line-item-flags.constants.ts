/** Written when a line's match confidence sits within the close-tie margin of another candidate; advisory only, never forces review on its own. */
export const CLOSE_TIE_FLAG = 'close_tie';

/** Written when an estimator manually sets a line's price; recompute preserves it instead of re-pricing. */
export const MANUAL_OVERRIDE_FLAG = 'manual_override';
