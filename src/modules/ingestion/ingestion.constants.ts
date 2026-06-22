/** Upload constraints and the multipart file shape for the ingestion endpoint. */

/** Org used when auth is disabled; mirrors the nil UUID set by the RLS middleware in demo mode. */
export const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

/** Max attachment size. TRD §6 caps uploads at 10 MB. */
export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Hard ceiling on attachments per request, a guard against a runaway multipart payload. */
export const MAX_FILES_PER_REQUEST = 20;

/** Allowed attachment extensions (lower-case, dot-prefixed). TRD §6 allowlist: pdf/csv/txt. */
export const ALLOWED_EXTENSIONS = new Set(['.pdf', '.csv', '.txt']);

/** Declared mime types accepted alongside the extension check. Covers the common variants browsers
 * and tools send for pdf/csv/txt, including the generic application/octet-stream many clients use.
 * This is a secondary signal; true content validation would sniff magic bytes (follow-up). */
export const ALLOWED_MIMES = new Set([
  'application/pdf',
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
  'application/octet-stream',
]);

/** The slice of a Multer file the ingestion path uses. Declared locally to avoid a @types/multer dep
 * for a single shape; the FilesInterceptor (memory storage) populates exactly these fields. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
