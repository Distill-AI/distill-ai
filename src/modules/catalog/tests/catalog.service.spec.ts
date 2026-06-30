import { describe, expect, it, vi } from 'vitest';
import { CatalogService } from '../catalog.service';

function makeService(rows: unknown[] = []) {
  const query = vi.fn().mockResolvedValue(rows);
  const service = new CatalogService({ query } as never);
  return { service, query };
}

describe('CatalogService.searchSkus', () => {
  it('returns an empty list for a blank query without hitting the database', async () => {
    const { service, query } = makeService();
    expect(await service.searchSkus('   ', 'org-1')).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('scopes the query to the org when an org id is provided (SEC-02)', async () => {
    const { service, query } = makeService([{ sku_id: 'sku-1' }]);
    await service.searchSkus('socket', 'org-1', 5);

    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/org_id = \$2/);
    expect(params).toEqual(['socket', 'org-1', 5]);
  });

  it('omits the org filter when no caller org is known (single-tenant dev)', async () => {
    const { service, query } = makeService([]);
    await service.searchSkus('bolt', undefined);

    const [sql, params] = query.mock.calls[0];
    expect(sql).not.toMatch(/org_id =/);
    expect(params).toEqual(['bolt', 10]); // default limit, no org param
  });

  it('caps the limit at 25', async () => {
    const { service, query } = makeService([]);
    await service.searchSkus('nut', 'org-1', 999);
    expect(query.mock.calls[0][1]).toEqual(['nut', 'org-1', 25]);
  });
});
