import { describe, it } from 'vitest';

// Wire real imports here when MatchNode + RRF fusion exist:
// import { MatchNode }  from '../match.node';
// import { fuseRrf }    from '../rrf';

describe('matcher', () => {
  it('placeholder — assertions wired in E3', () => {
    // intentionally empty: reserves this suite in CI
  });

  it.todo('exact lexical match ranks above semantic-only match');
  it.todo('semantic-only match returns a result when lexical finds nothing');
  it.todo('RRF fusion of lexical + semantic scores produces correct merged ranking');
  it.todo('close-tie flag is set when top-2 scores are within the margin threshold');
  it.todo('close-tie flag is not set when top-1 score exceeds the margin threshold clearly');
  it.todo('results below MATCH_THRESHOLD are excluded from the candidate list');
});
