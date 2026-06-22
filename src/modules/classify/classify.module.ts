import { Module } from '@nestjs/common';
import { LLMModule } from '@modules/llm/llm.module';
import { ClassifyService } from './services/classify.service';

@Module({
  imports: [LLMModule],
  providers: [ClassifyService],
  exports: [ClassifyService],
})
export class ClassifyModule {}
