export enum ToolCallStatus {
  OK = 'ok',
  ERROR = 'error',
  TIMEOUT = 'timeout',
  VALIDATION_ERROR = 'validation_error',
}

export { ToolCallStatus as ToolStatus };

export enum ToolTier {
  FREE = 'free',
  PRO = 'pro',
  ENTERPRISE = 'enterprise',
  INTERNAL = 'internal',
}
