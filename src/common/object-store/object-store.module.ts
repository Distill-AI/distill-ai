import { Module } from '@nestjs/common';
import { env } from '@config/env';
import { FilesystemObjectStore, resolveStoreRoot } from './filesystem-object-store';
import { OBJECT_STORE } from './object-store.port';

/**
 * Wires the active {@link ObjectStore} behind the `OBJECT_STORE` token. V1 ships the filesystem
 * adapter driven by `OBJECT_STORE_URL`; swapping in Alibaba OSS later means changing only this
 * factory, not any consumer.
 */
@Module({
  providers: [
    {
      provide: OBJECT_STORE,
      useFactory: () => new FilesystemObjectStore(resolveStoreRoot(env.OBJECT_STORE_URL)),
    },
  ],
  exports: [OBJECT_STORE],
})
export class ObjectStoreModule {}
