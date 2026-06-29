import { Module } from '@nestjs/common';
import { CatalogModule } from './catalog.module';
import { LineItemModelAction } from './line-item.model-action';
import { LineItemsController } from './line-items.controller';
import { LineItemsService } from './line-items.service';

@Module({
  imports: [CatalogModule],
  controllers: [LineItemsController],
  providers: [LineItemsService, LineItemModelAction],
})
export class LineItemsModule {}
