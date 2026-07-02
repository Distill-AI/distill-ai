import { Module, OnModuleInit } from '@nestjs/common';
import { ToolsModule } from '@modules/tools/tools.module';
import { LLMModule } from '@modules/llm/llm.module';
import { ToolRegistry } from '@modules/tools/registry';
import { ScorerService } from './scorer.service';
import { ScoringConfigService } from './scoring-config.service';
import { ExplainRoutingToolFactory } from './tools/explain-routing.tool';

@Module({
  imports: [ToolsModule, LLMModule],
  providers: [ScorerService, ScoringConfigService, ExplainRoutingToolFactory],
  exports: [ScorerService, ScoringConfigService],
})
export class ScoringModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly explainRoutingFactory: ExplainRoutingToolFactory,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.explainRoutingFactory.create());
  }
}
