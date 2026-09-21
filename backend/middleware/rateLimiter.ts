import { Request, Response, NextFunction } from 'express';

export interface RateLimiterOptions {
  windowMs: number; // e.g. 10 * 60 * 1000 (10 minutes)
  max: number; // max requests per windowMs
  keyGenerator?: (req: Request) => string;
  message?: string;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const store = new Map<string, RateLimitRecord>();
  const { windowMs, max, message } = options;

  const keyGen =
    options.keyGenerator ||
    ((req: Request) => {
      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
      }
      return req.ip || req.socket.remoteAddress || '127.0.0.1';
    });

  const rateLimiterMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGen(req);
    const now = Date.now();
    let record = store.get(key);

    // Clean up expired entry or initialize
    if (!record || now >= record.resetAt) {
      record = {
        count: 0,
        resetAt: now + windowMs,
      };
      store.set(key, record);
    }

    record.count += 1;
    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetAt - now) / 1000);

    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > max) {
      res.status(429).json({
        data: null,
        meta: null,
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: message || 'Too many submissions received. Please slow down and try again later.',
        },
      });
      return;
    }

    next();
  };

  // Helper method to clear store in tests
  rateLimiterMiddleware.reset = () => {
    store.clear();
  };

  return rateLimiterMiddleware;
}

// Global default rate limiter for public submission endpoints: 5 submissions per 10 minutes
export const submissionRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Too many submissions from this connection. Please wait before trying again.',
});

// Authentication rate limiter: 20 login attempts per 15 minutes per IP
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please wait 15 minutes before trying again.',
});

// Global API rate limiter: 1000 requests per 15 minutes per IP
export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: 'Rate limit exceeded for API requests. Please wait a few moments.',
});

// Event registration rate limiter: 100 requests per 15 minutes per IP (allowing high attendee throughput)
export const eventRegistrationRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many event registration attempts from this connection. Please wait before trying again.',
});
