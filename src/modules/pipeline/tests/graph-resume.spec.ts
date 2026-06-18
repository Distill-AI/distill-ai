import { describe, it } from 'vitest';

// Wire real imports here when PipelineGraphEngine + PipelineRunner exist:
// import { PipelineGraphEngine } from '../graph.engine';
// import { PipelineRunner }      from '../pipeline.runner';

describe('graph-resume', () => {
  it('placeholder — assertions wired in E8 / US-E8-4', () => {
    // intentionally empty: reserves this suite in CI
  });

  it.todo('resumes at classify after a simulated crash mid-extract');
  it.todo('asserts exactly one extract_request tool_call row after kill-and-resume');
  it.todo('current_node checkpoint is written before the next node runs');
  it.todo('a crash mid-node re-runs that node (node-level resumability)');
  it.todo('RecoverySweep re-enqueues stale requests on boot');
  it.todo('RecoverySweep re-enqueues requests stale longer than SWEEP_STALE_SECONDS');
});
