import * as SYS_MSG from '@constants/system-messages';

export class DuplicateToolError extends Error {
  constructor(name: string) {
    super(SYS_MSG.TOOL_ALREADY_REGISTERED(name));
    this.name = 'DuplicateToolError';
  }
}

export class ReservedToolNameError extends Error {
  constructor(name: string) {
    super(SYS_MSG.TOOL_NAME_RESERVED(name));
    this.name = 'ReservedToolNameError';
  }
}

export class ToolNotFoundError extends Error {
  constructor(name: string) {
    super(SYS_MSG.TOOL_NOT_FOUND(name));
    this.name = 'ToolNotFoundError';
  }
}
