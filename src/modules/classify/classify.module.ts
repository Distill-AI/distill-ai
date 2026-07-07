import { Module, OnModuleInit } from '@nestjs/common';
import { LlmModule } from '@modules/llm/llm.module';
import { ToolsModule } from '@modules/tools/tools.module';
import { ToolRegistry } from '@modules/tools/registry';
import { ClassifyService } from './services/classify.service';
import { ClassifyRequestToolFactory } from './tools/classify-request.tool';

@Module({
  imports: [LlmModule, ToolsModule],
  providers: [ClassifyService, ClassifyRequestToolFactory],
  exports: [ClassifyService, ClassifyRequestToolFactory],
})
export class ClassifyModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly factory: ClassifyRequestToolFactory,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.factory.create());
  }
}
