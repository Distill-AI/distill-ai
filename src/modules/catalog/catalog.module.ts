import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LineItem } from './entities/line-item.entity';
import { Sku } from './entities/sku.entity';
import { CandidateMatch } from './entities/candidate-match.entity';

/** Registers LineItem, Sku, and CandidateMatch so the LineItem -> Sku relation resolves under autoLoadEntities. */
// Sku also relates to Organization, which is registered in RequestsDataModule (in the import graph alongside this).
@Module({
  imports: [TypeOrmModule.forFeature([LineItem, Sku, CandidateMatch])],
  exports: [TypeOrmModule],
})
export class CatalogModule {}
