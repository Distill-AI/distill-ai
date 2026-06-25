import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { env } from '@config/env';
import type { ToolContract } from '@modules/tools/interfaces/tool-contract.interface';
import { MatchMethod } from '../enums/match-method.enum';
import { EmbeddingUnavailableError } from '../errors/catalog.errors';
import { EmbeddingsClientService } from '../embeddings-client.service';
import { SkuSearchActions } from '../actions/sku-search.actions';
import { fuseRrf } from '../rrf';

const SearchCatalogInputSchema = z.object({
  query: z.string().min(1, 'query must not be empty'),
  orgId: z.string().uuid(),
  limit: z.number().int().min(1).max(20).default(5),
});

const SearchCatalogOutputSchema = z.object({
  candidates: z.array(
    z.object({
      sku_id: z.string().uuid(),
      sku_code: z.string(),
      name: z.string(),
      description: z.string().nullable(),
      score: z.number().min(0).max(1),
      rank: z.number().int().min(1),
      match_method: z.nativeEnum(MatchMethod),
    }),
  ),
  degraded: z.boolean(),
});

type SearchCatalogInput = z.infer<typeof SearchCatalogInputSchema>;
type SearchCatalogOutput = z.infer<typeof SearchCatalogOutputSchema>;

@Injectable()
export class SearchCatalogToolFactory {
  constructor(
    private readonly skuSearch: SkuSearchActions,
    private readonly embeddingsClient: EmbeddingsClientService,
  ) {}

  /** Creates and returns the search_catalog ToolContract. */
  create(): ToolContract<typeof SearchCatalogInputSchema, typeof SearchCatalogOutputSchema> {
    const skuSearch = this.skuSearch;
    const embeddingsClient = this.embeddingsClient;

    return {
      toolName: 'search_catalog',
      description:
        'Search the SKU catalog using lexical (pg_trgm) and semantic (pgvector) retrieval fused with RRF.',
      inputSchema: SearchCatalogInputSchema,
      outputSchema: SearchCatalogOutputSchema,

      async execute(input: SearchCatalogInput): Promise<SearchCatalogOutput> {
        const { query, orgId, limit } = input;

        const lexicalRows = await skuSearch.lexicalSearch(query, orgId, limit);

        let semanticRows = await (async () => {
          try {
            const vector = await embeddingsClient.embed(query);
            return await skuSearch.semanticSearch(vector, orgId, limit);
          } catch (err) {
            if (err instanceof EmbeddingUnavailableError) {
              return null;
            }
            throw err;
          }
        })();

        const degraded = semanticRows === null;
        if (semanticRows === null) semanticRows = [];

        const fused = fuseRrf(lexicalRows, semanticRows).filter(
          (c) => c.score >= env.MATCH_THRESHOLD,
        );

        const candidates = fused.slice(0, limit).map((c, i) => ({
          sku_id: c.sku_id,
          sku_code: c.sku_code,
          name: c.name,
          description: c.description,
          score: c.score,
          rank: i + 1,
          match_method: c.match_method,
        }));

        return { candidates, degraded };
      },
    };
  }
}
