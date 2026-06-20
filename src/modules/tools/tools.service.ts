import { Injectable } from '@nestjs/common';
import { ToolRegistry } from './registry';
import { InvokeRequestDto, InvokeResponseDto } from './dto/tools.dtos';
import { ToolName } from '../pipeline/types';

@Injectable()
export class ToolsService {
  constructor(private readonly registry: ToolRegistry) {}

  async invoke(dto: InvokeRequestDto): Promise<InvokeResponseDto> {
    return this.registry.invoke(dto.toolName as ToolName, dto.args);
  }

  listTools(): Array<{ toolName: string; description: string }> {
    return this.registry.list();
  }
}
