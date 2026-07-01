/** Mirrors the backend ParseErrorReason enum (src/modules/requests/enums/parse-error-reason.enum.ts). */
export const REASON_LABELS = {
  corrupt: 'This file appears to be password-protected or corrupt.',
  no_text_layer: 'This file contains only scanned images with no readable text.',
  unsupported_format: 'This file format is not supported.',
  size_limit_exceeded: 'This file exceeds the maximum allowed size.',
  unknown: 'This file could not be read.',
} as const;

export type ParseErrorReason = keyof typeof REASON_LABELS;
