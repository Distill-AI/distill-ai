import * as SYS_MSG from '@constants/system-messages';

export class DuplicateToolError extends Error {
  constructor(name: string) {
    super(SYS_MSG.TOOL_ALREADY_REGISTERED(name));
    this.name = 'DuplicateToolError';
  }
}
