/** Upload constraints and the multipart file shape for the ingestion endpoint. */

/** Org used when auth is disabled; mirrors the nil UUID set by the RLS middleware in demo mode. */
export const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000000';

/** Max attachment size. TRD §6 caps uploads at 10 MB. */
export const MAX_UPLOAD_MB = 10;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

/** Hard ceiling on attachments per request, a guard against a runaway multipart payload. */
export const MAX_FILES_PER_REQUEST = 20;

/**
 * Allowed attachment types (TRD §6 allowlist: pdf/csv/txt), keyed by extension so the declared mime
 * is validated AS A PAIR with the extension, not independently: `.txt` + `application/pdf` is rejected
 * even though both appear elsewhere in the map. `application/octet-stream` is accepted for every
 * extension because many clients send it generically. This is a secondary signal; true content
 * validation would sniff magic bytes (follow-up).
 */
export const ALLOWED_TYPES: Record<string, ReadonlySet<string>> = {
  '.pdf': new Set(['application/pdf', 'application/octet-stream']),
  '.csv': new Set([
    'text/csv',
    'application/csv',
    'application/vnd.ms-excel',
    'text/plain',
    'application/octet-stream',
  ]),
  '.txt': new Set(['text/plain', 'application/octet-stream']),
};

/** Lower-case, dot-prefixed extensions accepted. Derived from {@link ALLOWED_TYPES}. */
export const ALLOWED_EXTENSIONS = new Set(Object.keys(ALLOWED_TYPES));

/** The slice of a Multer file the ingestion path uses. Declared locally to avoid a @types/multer dep
 * for a single shape; the FilesInterceptor (memory storage) populates exactly these fields. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}
