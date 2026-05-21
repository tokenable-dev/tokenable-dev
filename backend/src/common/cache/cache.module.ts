import { Global, Module } from '@nestjs/common';
import { MemoryTtlCacheProvider } from './memory-ttl-cache.provider';
import { TTL_CACHE_PROVIDER } from './ttl-cache.interface';

@Global()
@Module({
  providers: [
    MemoryTtlCacheProvider,
    {
      provide: TTL_CACHE_PROVIDER,
      useExisting: MemoryTtlCacheProvider,
    },
  ],
  exports: [TTL_CACHE_PROVIDER, MemoryTtlCacheProvider],
})
export class CacheModule {}
