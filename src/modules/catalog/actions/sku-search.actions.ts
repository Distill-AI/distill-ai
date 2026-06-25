import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { RrfLexicalHit, RrfSemanticHit } from '../interfaces/rrf.interfaces';

@Injectable()
export class SkuSearchActions {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Lexical retrieval using pg_trgm word_similarity.
   * Uses the GIN gin_trgm_ops index via the <% operator; a bare function
   * comparison (word_similarity(...) > n) cannot use the index.
   */
  async lexicalSearch(query: string, orgId: string, limit: number): Promise<RrfLexicalHit[]> {
    return this.dataSource.query(
      `SELECT id AS sku_id, sku_code, name, description,
              word_similarity($1, name || ' ' || COALESCE(description, '')) AS sim_score
       FROM skus
       WHERE org_id = $2
         AND $1 <% (name || ' ' || COALESCE(description, ''))
       ORDER BY sim_score DESC
       LIMIT $3`,
      [query, orgId, limit],
    );
  }

  /** Semantic retrieval using pgvector cosine distance (org-scoped per SEC-02). */
  async semanticSearch(vector: number[], orgId: string, limit: number): Promise<RrfSemanticHit[]> {
    const vectorLiteral = `[${vector.join(',')}]`;
    return this.dataSource.query(
      `SELECT id AS sku_id, sku_code, name, description,
              1 - (embedding <=> $1::vector) AS sim_score
       FROM skus
       WHERE org_id = $2
         AND embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $3`,
      [vectorLiteral, orgId, limit],
    );
  }
}
