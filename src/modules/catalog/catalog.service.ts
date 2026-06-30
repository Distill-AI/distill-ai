import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

/** One catalog SKU returned by the manual search in the re-map drawer (US-E6-2). */
export interface SkuSearchResult {
  sku_id: string;
  sku_code: string;
  name: string;
  description: string | null;
  base_price_minor: number;
  currency: string;
  lead_time_days: number | null;
  score: number;
}

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

/**
 * Catalog SKU search for the re-map drawer's manual fallback (US-E6-2 FR-1). Lexical pg_trgm match
 * over sku_code / name / description, org-scoped when a caller org is known (SEC-02). It mirrors the
 * matching pipeline's lexical retrieval but returns the price fields the drawer renders.
 */
@Injectable()
export class CatalogService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** Returns SKUs ranked by trigram similarity to the query; org-scoped when orgId is provided. */
  async searchSkus(
    query: string,
    orgId: string | undefined,
    limit = DEFAULT_LIMIT,
  ): Promise<SkuSearchResult[]> {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      return [];
    }
    const cappedLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const haystack = `COALESCE(sku_code, '') || ' ' || COALESCE(name, '') || ' ' || COALESCE(description, '')`;

    // Org filter is applied as an extra predicate only when a caller org is known, so single-tenant
    // dev (auth disabled) still returns results while a real caller never sees another org's SKUs.
    const params: unknown[] = [trimmed];
    let orgClause = '';
    if (orgId !== undefined) {
      params.push(orgId);
      orgClause = `AND org_id = $${params.length}`;
    }
    params.push(cappedLimit);
    const limitParam = `$${params.length}`;

    return this.dataSource.query(
      `SELECT id AS sku_id, sku_code, name, description, base_price_minor, currency, lead_time_days,
              word_similarity($1, ${haystack}) AS score
         FROM skus
        WHERE $1 <% (${haystack})
          ${orgClause}
        ORDER BY score DESC
        LIMIT ${limitParam}`,
      params,
    );
  }
}
