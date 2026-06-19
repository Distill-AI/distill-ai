import { Injectable } from '@nestjs/common';
import { ToolRegistry } from './registry';
import { InvokeRequestDto, InvokeResponseDto } from './dto/tools.dtos';
import { ToolContract } from './interfaces/tool-contract.interface';
import { z } from 'zod';

@Injectable()
export class ToolsService {
  constructor(private readonly registry: ToolRegistry) {}

  async invoke(dto: InvokeRequestDto): Promise<InvokeResponseDto> {
    return this.registry.invoke(dto.toolName, dto.args);
  }

  listTools(): Array<{ toolName: string; description: string }> {
    return Array.from(this.registry['registry'].entries()).map(
      ([, contract]: [string, ToolContract<z.ZodTypeAny, z.ZodTypeAny>]) => ({
        toolName: contract.toolName,
        description: contract.description,
      }),
    );
  }
}
