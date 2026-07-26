const localMemoryCache = new Map<string, { value: any; expiry: number }>();

export function getCache(key: string): any | null {
  const item = localMemoryCache.get(key);
  if (!item) return null;

  if (Date.now() > item.expiry) {
    localMemoryCache.delete(key);
    return null;
  }

  return item.value;
}

export function setCache(key: string, value: any, ttlSeconds: number = 60): void {
  const expiry = Date.now() + ttlSeconds * 1000;
  localMemoryCache.set(key, { value, expiry });
}

export function clearCache(keyPrefix: string): void {
  for (const key of localMemoryCache.keys()) {
    if (key.startsWith(keyPrefix)) {
      localMemoryCache.delete(key);
    }
  }
}

export function clearAllCache(): void {
  localMemoryCache.clear();
}
