/** Upload constraints and the multipart file shape for the ingestion endpoint (US-E1-1, US-E1-3). */

/** Org used when auth is disabled; mirrors the nil UUID set by the RLS middleware in demo mode. */
export const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

/** Max attachment size. TRD §6 caps uploads at 10 MB. */
export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Hard ceiling on attachments per request, a guard against a runaway multipart payload. */
export const MAX_FILES_PER_REQUEST = 20;

/** Allowed attachment extensions (lower-case, dot-prefixed). TRD §6 allowlist: pdf/csv/txt. */
export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.csv', '.txt']);

/** The slice of a Multer file the ingestion path uses. Declared locally to avoid a @types/multer dep
 * for a single shape; the FilesInterceptor (memory storage) populates exactly these fields. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
