import { Body, Controller, Get, HttpStatus, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';
import { ToolsService } from './tools.service';
import { InvokeRequestDto } from './dto/invoke.request.dto';
import { InvokeResponseDto } from './dto/invoke.response.dto';
import { InvokeToolDocs, ListToolsDocs } from './docs/tools-swagger.doc';

@ApiTags('Tools')
@Controller('tools')
export class ToolsController {
  constructor(private readonly toolsService: ToolsService) {}

  @Post('invoke')
  @InvokeToolDocs()
  async invoke(@Body() dto: InvokeRequestDto): Promise<{
    statusCode: number;
    message: string;
    data: InvokeResponseDto;
  }> {
    const result = await this.toolsService.invoke(dto);
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.TOOL_INVOKE_SUCCESS,
      data: result,
    };
  }

  @Get()
  @ListToolsDocs()
  list(): {
    statusCode: number;
    message: string;
    data: Array<{ toolName: string; description: string }>;
  } {
    const tools = this.toolsService.listTools();
    return {
      statusCode: HttpStatus.OK,
      message: SYS_MSG.TOOL_LIST_SUCCESS,
      data: tools,
    };
  }
}
