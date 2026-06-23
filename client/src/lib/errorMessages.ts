const messages: Record<string, string> = {
  VALIDATION_ERROR: 'Please check your input and try again.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
};

export function resolveServerError(code: string | undefined): string {
  if (!code) return 'Something went wrong. Please try again.';
  return messages[code] ?? 'Something went wrong. Please try again.';
}
