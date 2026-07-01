/**
 * Object-store port.
 *
 * The pipeline stores the original bytes of every attachment (and later exported quotes) here, and
 * the download endpoint (US-E1-5-T1) reads them back. Consumers depend on this interface, never on a
 * concrete driver, so the local-filesystem adapter can be swapped for Alibaba OSS without touching
 * callers. Inject it with the `OBJECT_STORE` token.
 */
export interface ObjectStore {
  /**
   * Persist `bytes` under `key` and return the `storage_url` to record on the attachment row.
   * The returned value is whatever `get` needs to read the object back.
   */
  put(key: string, bytes: Buffer): Promise<string>;

  /** Read back the bytes previously stored, addressed by the `storage_url` that `put` returned. */
  get(storageUrl: string): Promise<Buffer>;
}

/** DI token for the active {@link ObjectStore} implementation. */
export const OBJECT_STORE = Symbol('OBJECT_STORE');

/** Thrown by {@link ObjectStore.get} when `storageUrl` does not resolve to a stored object, as
 * distinct from a retrieval/transport failure. Callers use this to tell a genuinely missing object
 * (404) apart from a transient store outage (502/503). */
export class ObjectNotFoundError extends Error {
  constructor(storageUrl: string) {
    super(`Object not found: ${storageUrl}`);
    this.name = 'ObjectNotFoundError';
  }
}
