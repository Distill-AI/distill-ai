import { Module } from '@nestjs/common';
import { LineItemsController } from './line-items.controller';
import { LineItemsService } from './line-items.service';

@Module({
  controllers: [LineItemsController],
  providers: [LineItemsService],
})
export class LineItemsModule {}
