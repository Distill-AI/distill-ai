import { describe, it } from 'vitest';

// Wire real imports here when ExtractNode + reconcile() exist:
// import { ExtractNode }  from '../extract.node';
// import { reconcile }    from '../reconcile';

describe('reconciliation', () => {
  it('placeholder — assertions wired in E2', () => {
    // intentionally empty: reserves this suite in CI
  });

  it.todo('schema failure triggers exactly one re-ask with priorFailure threaded into the prompt');
  it.todo('totals mismatch triggers exactly one re-ask with priorFailure threaded into the prompt');
  it.todo('two consecutive failures escalate (schema_valid=false) and continue to classify');
  it.todo('a valid extraction on the first attempt records reextract_count=0');
  it.todo('a valid extraction on retry records reextract_count=1');
  it.todo('re-entry when schema_valid is already true skips the LLM call (resume-safety)');
});
