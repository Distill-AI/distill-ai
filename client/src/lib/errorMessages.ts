export const CLIENT_ERROR_MESSAGES: Record<string, string> = {
  FILE_TYPE_INVALID: 'Unsupported file type',
  FILE_SIZE_EXCEEDED: 'File exceeds the size limit',
  'Unprocessable Entity': 'The request could not be processed. Check your input and try again.',
  'Bad Request': 'The request could not be processed. Check your input and try again.',
  'Payload Too Large': 'File too large. Maximum size is 10 MB.',
};

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

export function resolveServerError(errorCode: string | undefined): string {
  if (!errorCode) return GENERIC_ERROR;
  return CLIENT_ERROR_MESSAGES[errorCode] ?? GENERIC_ERROR;
}
