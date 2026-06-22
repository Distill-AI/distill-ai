import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { HttpStatus, Logger } from '@nestjs/common';
import { CustomHttpException } from '@common/exceptions/custom-http.exception';
import * as SYS_MSG from '@constants/system-messages';
import type { ObjectStore } from './object-store.port';

/**
 * Resolve the on-disk root from an `OBJECT_STORE_URL`. Accepts a bare path or a `file://` URL and
 * rejects any other scheme, so a misconfigured `s3://`/`oss://` URL fails fast at boot instead of
 * silently writing attachments to the wrong place. A blank value (or `file://` with no path) is
 * rejected too, rather than silently defaulting to the process CWD.
 */
export function resolveStoreRoot(objectStoreUrl: string): string {
  const trimmed = objectStoreUrl.trim();
  if (!trimmed) {
    throw new Error(SYS_MSG.OBJECT_STORE_URL_REQUIRED);
  }
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed);
  if (scheme && scheme[1].toLowerCase() !== 'file') {
    throw new Error(SYS_MSG.OBJECT_STORE_UNSUPPORTED_SCHEME(scheme[1]));
  }
  // Strip the matched scheme (whatever its casing), not a case-sensitive literal, so `FILE://` works.
  const path = (scheme ? trimmed.slice(scheme[0].length) : trimmed).trim();
  if (!path) {
    throw new Error(SYS_MSG.OBJECT_STORE_URL_REQUIRED);
  }
  return resolve(path);
}

/**
 * Local-filesystem {@link ObjectStore}. The `storage_url` it returns is the object key itself, which
 * `get` resolves back against the configured root. Keys are confined to the root: a key that would
 * escape it (path traversal) is rejected rather than served.
 */
export class FilesystemObjectStore implements ObjectStore {
  private readonly logger = new Logger(FilesystemObjectStore.name);
  private readonly root: string;

  constructor(root: string) {
    // Normalise to absolute so the confinement check below is reliable for relative inputs too.
    this.root = resolve(root);
  }

  async put(key: string, bytes: Buffer): Promise<string> {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
    this.logger.debug({ event: 'object_put', key, size_bytes: bytes.length });
    return key;
  }

  async get(storageUrl: string): Promise<Buffer> {
    return readFile(this.resolveKey(storageUrl));
  }

  /** Resolve a key under the root, refusing a blank key or any key that escapes the root. Both are
   * bad input (a download endpoint passes a stored key here), so they surface as 400, not 500. */
  private resolveKey(key: string): string {
    if (!key.trim()) {
      throw new CustomHttpException(SYS_MSG.OBJECT_STORE_KEY_BLANK, HttpStatus.BAD_REQUEST);
    }
    const path = resolve(this.root, key);
    const rel = relative(this.root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) {
      throw new CustomHttpException(SYS_MSG.OBJECT_STORE_KEY_TRAVERSAL, HttpStatus.BAD_REQUEST);
    }
    return path;
  }
}
