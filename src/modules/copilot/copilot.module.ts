import { Module } from '@nestjs/common';
import { RequestsModule } from '@modules/requests/requests.module';
import { CatalogModule } from '@modules/catalog/catalog.module';
import { ToolsModule } from '@modules/tools/tools.module';
import { RedisModule } from '@modules/redis/redis.module';
import { LineItemModelAction } from '@modules/catalog/line-item.model-action';
import { AgenticCopilotService } from './agentic/agentic-copilot.service';
import { CopilotController } from './copilot.controller';
import { CopilotService } from './copilot.service';

// LineItemModelAction is declared as a provider here (not imported via LineItemsModule, which
// doesn't export it) - same pattern ExtractionModule uses: CatalogModule supplies the
// TypeOrmModule.forFeature([LineItem, ...]) registration, each consumer declares its own action.
@Module({
  imports: [RequestsModule, CatalogModule, ToolsModule, RedisModule],
  controllers: [CopilotController],
  providers: [CopilotService, AgenticCopilotService, LineItemModelAction],
})
export class CopilotModule {}
