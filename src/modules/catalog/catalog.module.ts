import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineItem } from './entities/line-item.entity';
import { Sku } from './entities/sku.entity';
import { CandidateMatch } from './entities/candidate-match.entity';

/**
 * Registers the catalog entities (Sku, LineItem, CandidateMatch) with the
 * connection. With `autoLoadEntities`, an entity is only loaded where it is
 * registered via `forFeature`; Sku and CandidateMatch had no home, so the
 * LineItem -> Sku relation could not be built and the app failed to boot once
 * the RequestsModule <-> ExtractionModule cycle was resolved.
 */
@Module({
  imports: [TypeOrmModule.forFeature([LineItem, Sku, CandidateMatch])],
  exports: [TypeOrmModule],
})
export class CatalogModule {}
