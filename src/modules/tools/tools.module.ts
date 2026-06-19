/* src/modules/tools/tools.module.ts */
import { Module, OnModuleInit } from '@nestjs/common';
import { ToolRegistry } from './registry';
import { ToolCallsActions } from './actions/tool-calls.actions';
import { ToolsService } from './tools.service';
import { ToolsController } from './tools.controller';
import { EchoTool } from './tools/echo-tool';

@Module({
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
