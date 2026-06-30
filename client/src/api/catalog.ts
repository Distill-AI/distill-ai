import { useQuery } from '@tanstack/react-query';
import client from './client';

/** One catalog SKU from the manual search (GET /catalog/skus, US-E6-2). */
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

export async function searchSkus(q: string): Promise<SkuSearchResult[]> {
  const res = await client.get<{ data: SkuSearchResult[] }>('/catalog/skus', { params: { q } });
  return res.data.data;
}

/** Searches the catalog; disabled (no request) until the query is non-empty. */
export function useSkuSearch(q: string) {
  const trimmed = q.trim();
  return useQuery({
    queryKey: ['catalog', 'skus', trimmed],
    queryFn: () => searchSkus(trimmed),
    enabled: trimmed.length > 0,
  });
}
