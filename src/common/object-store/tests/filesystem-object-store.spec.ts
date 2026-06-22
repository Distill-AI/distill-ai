import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FilesystemObjectStore, resolveStoreRoot } from '../filesystem-object-store';

describe('FilesystemObjectStore', () => {
  let root: string;
  let store: FilesystemObjectStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'objstore-'));
    store = new FilesystemObjectStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('round-trips bytes through put then get', async () => {
    const bytes = Buffer.from('hello attachment');
    const url = await store.put('attachments/req-1/a.txt', bytes);

    const back = await store.get(url);
    expect(back.equals(bytes)).toBe(true);
  });

  it('returns the key as the storage_url and writes nested dirs', async () => {
    const url = await store.put('attachments/req-1/deep/a.pdf', Buffer.from('x'));
    expect(url).toBe('attachments/req-1/deep/a.pdf');
    const onDisk = await readFile(join(root, 'attachments/req-1/deep/a.pdf'));
    expect(onDisk.toString()).toBe('x');
  });

  it('throws when reading a key that was never written', async () => {
    await expect(store.get('attachments/missing.txt')).rejects.toThrow();
  });

  it('rejects a key that escapes the store root (path traversal)', async () => {
    await expect(store.put('../escape.txt', Buffer.from('x'))).rejects.toThrow(
      /escapes store root/,
    );
    await expect(store.get('../../etc/passwd')).rejects.toThrow(/escapes store root/);
  });

  it('rejects a blank key', async () => {
    await expect(store.put('   ', Buffer.from('x'))).rejects.toThrow(/must not be blank/);
    await expect(store.get('')).rejects.toThrow(/must not be blank/);
  });

  it('does not falsely reject a valid key when the root is the filesystem root', async () => {
    const rootStore = new FilesystemObjectStore('/');
    // Regression guard: the old `path.startsWith(root + sep)` check became `startsWith('//')` when
    // root was '/', wrongly rejecting every key. A normal key must now pass confinement and only
    // fail later at readFile.
    await expect(rootStore.get('definitely/missing/a.txt')).rejects.toThrow(/ENOENT|no such file/i);
  });
});

describe('resolveStoreRoot', () => {
  it('strips the file:// scheme and resolves to an absolute path', () => {
    expect(resolveStoreRoot('file://./var/object-store')).toMatch(/var[\\/]object-store$/);
  });

  it('accepts a bare path', () => {
    expect(resolveStoreRoot('./var/store')).toMatch(/var[\\/]store$/);
  });

  it('strips the scheme case-insensitively (FILE://)', () => {
    expect(resolveStoreRoot('FILE://./var/object-store')).toMatch(/var[\\/]object-store$/);
  });

  it('rejects any non-file scheme so misconfiguration fails fast', () => {
    expect(() => resolveStoreRoot('s3://bucket/key')).toThrow(
      /Unsupported OBJECT_STORE_URL scheme/,
    );
    expect(() => resolveStoreRoot('oss://bucket')).toThrow(/Unsupported OBJECT_STORE_URL scheme/);
  });

  it('rejects a blank value or a file:// URL with no path', () => {
    expect(() => resolveStoreRoot('   ')).toThrow(/non-empty path/);
    expect(() => resolveStoreRoot('file://')).toThrow(/non-empty path/);
  });
});
