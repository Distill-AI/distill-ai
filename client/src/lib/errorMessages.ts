export const CLIENT_ERROR_MESSAGES: Record<string, string> = {
  FILE_TYPE_INVALID: 'Unsupported file type',
  FILE_SIZE_EXCEEDED: 'File exceeds the size limit',
  UNPROCESSABLE_ENTITY: 'The request could not be processed. Check your input and try again.',
  BAD_REQUEST: 'The request could not be processed. Check your input and try again.',
  PAYLOAD_TOO_LARGE: 'The payload is too large. Reduce the amount of content and try again.',
};

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function resolveServerError(errorCode: string | undefined): string {
  if (!errorCode) return GENERIC_ERROR;
  return CLIENT_ERROR_MESSAGES[errorCode] ?? GENERIC_ERROR;
}
