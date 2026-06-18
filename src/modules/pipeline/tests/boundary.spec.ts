import { describe, it } from 'vitest';

// Wire real imports here when PipelineGraphEngine + tool_calls repository exist:
// import { PipelineGraphEngine } from '../graph.engine';
// import { ToolCallModelAction } from '../../tools/tool-call.model-action';

describe('boundary', () => {
  it('placeholder — assertions wired in E4 / US-E4-3', () => {
    // intentionally empty: reserves this suite in CI
  });

  it.todo('price node produces zero tool_call rows');
  it.todo('policy node produces zero tool_call rows');
  it.todo('score node produces zero tool_call rows');
  it.todo('full parse→score run: tool_calls contains only extract_request and search_catalog');
});
