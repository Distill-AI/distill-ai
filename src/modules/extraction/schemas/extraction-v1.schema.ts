import { z } from 'zod';

export const UNKNOWN_FIELD = 'UNKNOWN';

function isValidIsoDate(value: string): boolean {
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number.parseInt(yearText, 10);
  const month = Number.parseInt(monthText, 10);
  const day = Number.parseInt(dayText, 10);

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export const ExtractionLineItemSchema = z.object({
  position: z.number().finite().int().positive(),
  raw_text: z.string().min(1),
  quantity: z.number().finite().positive(),
  unit: z.string().min(1),
});

export const ExtractionV1Schema = z.object({
  company: z.string().min(1),
  contact: z.string().min(1),
  sender_email: z.string().email().nullable(),
  delivery_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isValidIsoDate, { message: 'Invalid calendar date' })
    .nullable(),
  line_items: z.array(ExtractionLineItemSchema).min(1),
});

export type ExtractionLineItem = z.infer<typeof ExtractionLineItemSchema>;
export type ExtractionV1 = z.infer<typeof ExtractionV1Schema>;

export const ExtractRequestInputSchema = z.object({
  text: z.string(),
  priorFailure: z.string().nullable(),
});

export type ExtractRequestInput = z.infer<typeof ExtractRequestInputSchema>;

/** Formats Zod validation errors for corrective re-ask prompts. */
export function formatSchemaError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    })
    .join('; ');
}
