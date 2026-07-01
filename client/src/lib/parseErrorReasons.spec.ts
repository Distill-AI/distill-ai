import { REASON_LABELS } from './parseErrorReasons';

describe('REASON_LABELS', () => {
  it('covers every backend ParseErrorReason value', () => {
    expect(Object.keys(REASON_LABELS)).toEqual([
      'corrupt',
      'no_text_layer',
      'unsupported_format',
      'size_limit_exceeded',
      'unknown',
    ]);
  });
});
