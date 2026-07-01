import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LLMModule } from '@modules/llm/llm.module';
import { ToolsModule } from '@modules/tools/tools.module';
import { ToolRegistry } from '@modules/tools/registry';
import { Clarification } from './entities/clarification.entity';
import { ClarificationActions } from './actions/clarification.actions';
import { ClarificationService } from './clarification.service';
import { ClarificationController } from './clarification.controller';
import { DraftClarificationToolFactory } from './tools/draft-clarification.tool';

@Module({
  imports: [TypeOrmModule.forFeature([Clarification]), LLMModule, ToolsModule],
  controllers: [ClarificationController],
  providers: [ClarificationActions, ClarificationService, DraftClarificationToolFactory],
  exports: [ClarificationService, ClarificationActions],
})
export class ClarificationModule implements OnModuleInit {
  constructor(
    private readonly registry: ToolRegistry,
    private readonly draftToolFactory: DraftClarificationToolFactory,
  ) {}

  onModuleInit(): void {
    this.registry.register(this.draftToolFactory.create());
  }
}
