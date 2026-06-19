import * as SYS_MSG from '@constants/system-messages';

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(SYS_MSG.TOOL_NOT_FOUND(name));
    this.name = 'ToolNotFoundError';
  }
}
