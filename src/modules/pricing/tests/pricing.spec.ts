import { describe, it } from 'vitest';

// Wire real imports here when PricingService + PolicyService exist:
// import { PricingService } from '../pricing.service';
// import { PolicyService }  from '../policy.service';

describe('pricing', () => {
  it('placeholder — assertions wired in E4', () => {
    // intentionally empty: reserves this suite in CI
  });

  it.todo('identical input produces identical output (pure deterministic function)');
  it.todo('margin-floor breach is flagged unconditionally regardless of other fields');
  it.todo('PriceNode never injects ToolRegistry (wiring-level boundary check)');
  it.todo('PolicyNode never injects ToolRegistry (wiring-level boundary check)');
  it.todo('zero tool_calls rows attributed to price or policy nodes after a full run');
});
