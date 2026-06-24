export interface ParsedPagination {
  page: number;
  limit: number;
}

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Parses and clamps `page`/`limit` query params. Defaults apply only to missing/non-numeric values;
 * numeric out-of-range values are clamped (page >= 1, limit 1..100) so `limit=0` becomes 1, not 50.
 */
export function parsePagination(rawPage?: string, rawLimit?: string): ParsedPagination {
  const parsedPage = parseInt(rawPage ?? '', 10);
  const parsedLimit = parseInt(rawLimit ?? '', 10);

  const page = Math.max(Number.isNaN(parsedPage) ? DEFAULT_PAGE : parsedPage, 1);
  const limit = Math.min(
    Math.max(Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit, 1),
    MAX_LIMIT,
  );

  return { page, limit };
}
