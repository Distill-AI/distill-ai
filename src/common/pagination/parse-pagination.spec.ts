import { parsePagination } from './parse-pagination';

describe('parsePagination', () => {
  it('defaults to page 1, limit 50 when params are missing', () => {
    expect(parsePagination(undefined, undefined)).toEqual({ page: 1, limit: 50 });
  });

  it('defaults non-numeric values', () => {
    expect(parsePagination('abc', 'xyz')).toEqual({ page: 1, limit: 50 });
  });

  it('clamps limit=0 up to 1 instead of defaulting to 50', () => {
    expect(parsePagination('1', '0').limit).toBe(1);
  });

  it('clamps negative and over-max values into range', () => {
    expect(parsePagination('-3', '500')).toEqual({ page: 1, limit: 100 });
  });

  it('passes valid in-range values through', () => {
    expect(parsePagination('3', '25')).toEqual({ page: 3, limit: 25 });
  });
});
