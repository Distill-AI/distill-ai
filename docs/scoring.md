# Scoring (US-E5-1)

The score node runs as the final pipeline step, computing a single `overall_confidence` per quote.

## Purpose

A single overall confidence per quote tells an estimator instantly how much scrutiny a quote needs before opening it. The score is the deterministic source of the graph's routing decision (auto_eligible vs needs_review).

## Architecture

```
ScoreNode (pipeline node)
  ├── ScorerService (pure, deterministic, no tool access)
  │     ├── computeLineConfidenceFactor()
  │     ├── computePolicyComplianceFactor()
  │     └── computeDealValueFactor()
  └── RequestModelAction (persists routing + confidence)
```

- `ScoreNode` implements `PipelineNode` and registers itself with `NodeRegistry`
- `ScorerService` is a pure service with no tool registry access (SEC-01)
- The score node never injects `ToolRegistry` (verified by test)

## Scoring Formula

```
overall_confidence = min(
  lineConfidenceFactor,
  policyComplianceFactor,
  dealValueFactor
)
```

### Factors

| Factor | Description | Calculation |
|--------|-------------|-------------|
| `lineConfidenceFactor` | Minimum match confidence across all line items | `min(match_confidence)`; unmatched items use `unmatchedFloor` (default 0) |
| `policyComplianceFactor` | Whether policy flags exist on any line | `1.0` if no flags; `policyFlagPenalty` (default 0.5) otherwise |
| `dealValueFactor` | Whether deal value exceeds auto-send cap | `1.0` if under cap or cap unset; `dealValueExceededPenalty` (default 0.8) otherwise |

### Routing Decision

- `overall_confidence >= autoThreshold` (default 0.95) → `AUTO_ELIGIBLE` → status `priced`
- `overall_confidence < autoThreshold` → `NEEDS_REVIEW` → status `needs_review`

## Edge Cases

| Case | Behavior |
|------|----------|
| Extraction failure | Uses `scoreExtractionFailure()` path — returns `needs_review` with 0 confidence |
| All lines unmatched | All match_confidence = 0 → lineConfidenceFactor = 0 → needs_review |
| Zero line items | Returns needs_review with code `no_line_items` (no division by zero) |
| Re-run on identical data | Deterministic — same inputs always produce same output (EC-03) |

## Configuration (`scoring.config.ts`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SCORE_AUTO_THRESHOLD` | 0.95 | Minimum overall_confidence for auto-eligible routing |
| `SCORE_UNMATCHED_FLOOR` | 0 | Floor confidence assigned to unmatched line items |
| `SCORE_POLICY_FLAG_PENALTY` | 0.5 | Multiplier when policy flags are present |
| `SCORE_DEAL_VALUE_EXCEEDED_PENALTY` | 0.8 | Multiplier when deal value exceeds cap |
| `SCORE_AUTO_SEND_CAP_MINOR` | unset | Deal value cap in minor currency units; no cap check when unset |

## Security

- SEC-01: ScoreNode does not inject ToolRegistry — no LLM access for routing
- Deterministic service only, no external calls during scoring
