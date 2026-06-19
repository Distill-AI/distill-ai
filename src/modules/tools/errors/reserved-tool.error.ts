import * as SYS_MSG from '@constants/system-messages';

export class ReservedToolNameError extends Error {
  constructor(name: string) {
    super(SYS_MSG.TOOL_NAME_RESERVED(name));
    this.name = 'ReservedToolNameError';
  }
}
