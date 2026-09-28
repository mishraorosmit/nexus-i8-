import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: any;
  headers: Record<string, string>;
  expiresAt: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private domainKeys = new Map<string, Set<string>>();

  public get(key: string): { data: any; headers: Record<string, string> } | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return { data: entry.data, headers: entry.headers };
  }

  public set(domain: string, key: string, data: any, headers: Record<string, string>, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.cache.set(key, { data, headers, expiresAt });

    if (!this.domainKeys.has(domain)) {
      this.domainKeys.set(domain, new Set());
    }
    this.domainKeys.get(domain)!.add(key);
  }

  public invalidate(domain: string): void {
    const keys = this.domainKeys.get(domain);
    if (keys) {
      for (const k of keys) {
        this.cache.delete(k);
      }
      this.domainKeys.delete(domain);
    }
  }

  public clear(): void {
    this.cache.clear();
    this.domainKeys.clear();
  }
}

export const memoryCache = new MemoryCache();

/**
 * Cache middleware for public read-only endpoints.
 * @param domain Domain namespace for targeted cache invalidation
 * @param ttlSeconds TTL in seconds (defaults to 30 seconds)
 */
export function publicCache(domain: string, ttlSeconds: number = 30) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests without auth headers
    if (req.method !== 'GET' || req.headers.authorization) {
      return next();
    }

    const cacheKey = `${domain}:${req.originalUrl || req.url}`;
    const cached = memoryCache.get(cacheKey);

    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(cached.data);
    }

    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      // Only cache successful 200 responses (supporting both { success: true } and { error: null } apiSuccess format)
      if (res.statusCode === 200 && (body?.success || body?.error === null)) {
        memoryCache.set(domain, cacheKey, body, {}, ttlSeconds * 1000);
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}
