import { formatDuration } from './formatDuration';

describe('formatDuration', () => {
  it('formats whole seconds under a minute', () => {
    expect(formatDuration(45)).toBe('45s');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(493)).toBe('8m 13s');
  });

  it('rounds the total before splitting, not the seconds remainder in isolation', () => {
    expect(formatDuration(59.6)).toBe('1m 0s');
    expect(formatDuration(119.5)).toBe('2m 0s');
  });

  it('clamps a negative duration to 0s', () => {
    expect(formatDuration(-5)).toBe('0s');
  });

  it('treats a non-finite duration as 0s', () => {
    expect(formatDuration(NaN)).toBe('0s');
  });
});
