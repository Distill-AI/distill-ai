import { z } from 'zod';

const schema = z.object({
  SCORE_AUTO_THRESHOLD: z.coerce.number().min(0).max(1).default(0.95),
  SCORE_UNMATCHED_FLOOR: z.coerce.number().min(0).max(1).default(0),
  SCORE_POLICY_FLAG_PENALTY: z.coerce.number().min(0).max(1).default(0.5),
  SCORE_DEAL_VALUE_EXCEEDED_PENALTY: z.coerce.number().min(0).max(1).default(0.8),
  SCORE_AUTO_SEND_CAP_MINOR: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.coerce.number().int().nonnegative().optional(),
  ),
});

const result = schema.safeParse(process.env);

if (!result.success) {
  throw new Error(`Invalid scoring config: ${JSON.stringify(result.error.flatten().fieldErrors)}`);
}

export const scoringConfig = {
  autoThreshold: result.data.SCORE_AUTO_THRESHOLD,
  unmatchedFloor: result.data.SCORE_UNMATCHED_FLOOR,
  policyFlagPenalty: result.data.SCORE_POLICY_FLAG_PENALTY,
  dealValueExceededPenalty: result.data.SCORE_DEAL_VALUE_EXCEEDED_PENALTY,
  autoSendCapMinor: result.data.SCORE_AUTO_SEND_CAP_MINOR,
};
