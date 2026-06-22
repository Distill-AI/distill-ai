import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { Logger } from '@nestjs/common';
import type { ObjectStore } from './object-store.port';

const FILE_SCHEME = 'file://';

/**
 * Resolve the on-disk root from an `OBJECT_STORE_URL`. Accepts a bare path or a `file://` URL and
 * rejects any other scheme, so a misconfigured `s3://`/`oss://` URL fails fast at boot instead of
 * silently writing attachments to the wrong place.
 */
export function resolveStoreRoot(objectStoreUrl: string): string {
  const trimmed = objectStoreUrl.trim();
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(trimmed);
  if (scheme && scheme[1].toLowerCase() !== 'file') {
    throw new Error(`Unsupported OBJECT_STORE_URL scheme "${scheme[1]}"; V1 supports file:// only`);
  }
  const path = trimmed.startsWith(FILE_SCHEME) ? trimmed.slice(FILE_SCHEME.length) : trimmed;
  return resolve(path || '.');
}

/**
 * Local-filesystem {@link ObjectStore}. The `storage_url` it returns is the object key itself, which
 * `get` resolves back against the configured root. Keys are confined to the root: a key that would
 * escape it (path traversal) is rejected rather than served.
 */
export class FilesystemObjectStore implements ObjectStore {
  private readonly logger = new Logger(FilesystemObjectStore.name);

  constructor(private readonly root: string) {}

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

  /** Resolve a key under the root, refusing any key that escapes it. */
  private resolveKey(key: string): string {
    const path = resolve(this.root, key);
    if (path !== this.root && !path.startsWith(this.root + sep)) {
      throw new Error(`object key escapes store root: ${key}`);
    }
    return path;
  }
}
