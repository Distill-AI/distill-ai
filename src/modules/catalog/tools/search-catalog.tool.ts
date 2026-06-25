import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { z } from 'zod';
import { env } from '@config/env';
import type { ToolContract } from '@modules/tools/interfaces/tool-contract.interface';
import { MatchMethod } from '../enums/match-method.enum';
import { EmbeddingUnavailableError } from '../errors/catalog.errors';
import { EmbeddingsClientService } from '../embeddings-client.service';
import { fuseRrf } from '../rrf';
import type { RrfLexicalHit, RrfSemanticHit } from '../interfaces/rrf.interfaces';

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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly embeddingsClient: EmbeddingsClientService,
  ) {}

  /** Creates and returns the search_catalog ToolContract. */
  create(): ToolContract<typeof SearchCatalogInputSchema, typeof SearchCatalogOutputSchema> {
    const dataSource = this.dataSource;
    const embeddingsClient = this.embeddingsClient;

    return {
      toolName: 'search_catalog',
      description:
        'Search the SKU catalog using lexical (pg_trgm) and semantic (pgvector) retrieval fused with RRF.',
      inputSchema: SearchCatalogInputSchema,
      outputSchema: SearchCatalogOutputSchema,

      async execute(input: SearchCatalogInput): Promise<SearchCatalogOutput> {
        const { query, orgId, limit } = input;

        const lexicalRows: RrfLexicalHit[] = await dataSource.query(
          `SELECT id AS sku_id, sku_code, name, description,
                  word_similarity($1, name || ' ' || COALESCE(description, '')) AS sim_score
           FROM skus
           WHERE org_id = $2
             AND word_similarity($1, name || ' ' || COALESCE(description, '')) > 0.1
           ORDER BY sim_score DESC
           LIMIT $3`,
          [query, orgId, limit],
        );

        let semanticRows: RrfSemanticHit[] = [];
        let degraded = false;

        try {
          const vector = await embeddingsClient.embed(query);
          const vectorLiteral = `[${vector.join(',')}]`;

          semanticRows = await dataSource.query(
            `SELECT id AS sku_id, sku_code, name, description,
                    1 - (embedding <=> $1::vector) AS sim_score
             FROM skus
             WHERE org_id = $2
               AND embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $3`,
            [vectorLiteral, orgId, limit],
          );
        } catch (err) {
          if (err instanceof EmbeddingUnavailableError) {
            degraded = true;
          } else {
            throw err;
          }
        }

        const fused = fuseRrf(lexicalRows, semanticRows).filter(
          (c) => c.score >= env.MATCH_THRESHOLD,
        );

        const candidates = fused.map((c, i) => ({
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
