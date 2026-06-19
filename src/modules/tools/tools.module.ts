/* src/modules/tools/tools.module.ts */
import { Module, OnModuleInit } from '@nestjs/common';
import { ToolRegistry } from './registry';
import { ToolCallsActions } from './actions/tool-calls.actions';
import { EchoTool } from './tools/echo-tool';

@Module({
  providers: [ToolRegistry, ToolCallsActions],
  exports: [ToolRegistry],
})
export class ToolsModule implements OnModuleInit {
  constructor(private readonly registry: ToolRegistry) {}

  /** Register core stub tools when the module boots */
  onModuleInit() {
    this.registry.register(EchoTool);
  }
}
