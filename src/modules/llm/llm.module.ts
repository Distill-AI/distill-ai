import { Module } from '@nestjs/common';
import { LLMProvider } from './llm.provider';

@Module({
  providers: [LLMProvider],
  exports: [LLMProvider],
})
export class LLMModule {}
