import { describe, it } from 'vitest';

// Wire real imports here when ScorerService exists:
// import { ScorerService } from '../scorer.service';

describe('confidence', () => {
  it('placeholder — assertions wired in E5', () => {
    // intentionally empty: reserves this suite in CI
  });

  it.todo('routing is deterministic: same inputs always produce the same routing outcome');
  it.todo('routing is reproducible across process restarts');
  it.todo('score above AUTO_THRESHOLD routes to priced without review');
  it.todo('score below AUTO_THRESHOLD routes to needs_review');
  it.todo('ScoreNode never injects ToolRegistry (wiring-level boundary check)');
  it.todo('zero tool_calls rows attributed to score node after a full run');
});
