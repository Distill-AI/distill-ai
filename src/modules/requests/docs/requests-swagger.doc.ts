import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as SYS_MSG from '@constants/system-messages';

export function RequestEventsDocs(): MethodDecorator {
  return applyDecorators(
    ApiTags('Requests'),
    ApiOperation({
      summary: 'Stream live processing trace via SSE',
      description:
        'Opens a Server-Sent Events (SSE) connection that streams live processing trace events ' +
        'for the given request. Events are emitted as each pipeline stage executes: ' +
        'parse → extract → match → score → price → policy. ' +
        'Tool invocations (extract, match) are included with retry indicators. ' +
        'No raw model reasoning or chain-of-thought is emitted. ' +
        'The stream closes when processing completes (success or failure) or on client disconnect.',
    }),
    ApiParam({
      name: 'id',
      description: 'UUID of the request to trace',
      required: true,
      type: 'string',
      format: 'uuid',
    }),
    ApiProduces('text/event-stream'),
    ApiResponse({
      status: 200,
      description:
        'SSE event stream. Each event is formatted as:\n\n' +
        '```\n' +
        'event: node.entered\ndata: {"type":"node.entered","timestamp":"...","node":"parse","status":"processing"}\n\n' +
        'event: node.exited\ndata: {"type":"node.exited","timestamp":"...","node":"parse","status":"success","duration_ms":500,"summary":"Parsed email + attachments"}\n\n' +
        'event: tool.invoked\ndata: {"type":"tool.invoked","node":"extract","tool_name":"catalog_search","status":"running","attempt":1,"result_summary":"Invoking tool"}\n\n' +
        'event: processing.complete\ndata: {"type":"processing.complete","timestamp":"...","status":"success","total_duration_ms":10000}\n\n' +
        '```',
      content: { 'text/event-stream': { schema: { type: 'string' } } },
    }),
    ApiResponse({
      status: 404,
      description: SYS_MSG.REQUEST_NOT_FOUND('{id}'),
    }),
    ApiResponse({
      status: 401,
      description: SYS_MSG.AUTH_UNAUTHORIZED,
    }),
    ApiResponse({
      status: 403,
      description: SYS_MSG.AUTH_FORBIDDEN,
    }),
  );
}
