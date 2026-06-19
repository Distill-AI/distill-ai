/* src/modules/tools/tools.module.ts */
import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ToolRegistry } from './registry';
import { ToolCallsActions } from './actions/tool-calls.actions';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { ToolCallEntity } from './entities/tool-calls.entity';
import { RequestsModule } from '../requests/requests.module';
import { EventsModule } from '../events/events.module';
import { EchoTool } from './tools/echo-tool';

@Module({
  imports: [TypeOrmModule.forFeature([ToolCallEntity]), RequestsModule, EventsModule],
  controllers: [ToolsController],
  providers: [ToolRegistry, ToolCallsActions, ToolsService],
  exports: [ToolRegistry, ToolsService],
})
export class ToolsModule implements OnModuleInit {
  constructor(private readonly registry: ToolRegistry) {}

  /** Register core stub tools when the module boots */
  onModuleInit() {
    this.registry.register(EchoTool);
  }
}
