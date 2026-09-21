import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler.ts';
import { hashToken } from '../utils/crypto.ts';
import { adminSessionsRepository, type AuthenticatedAdminSession } from '../db/repositories/adminSessions.repository.ts';
import type { AdminRole } from '../db/repositories/adminUsers.repository.ts';

// Extend Express Request interface to include admin session
declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdminSession;
      sessionToken?: string;
    }
  }
}

/**
 * Extract session token from Authorization Bearer header or Cookie
 */
export function extractToken(req: Request): string | null {
  // 1. Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }

  // 2. Cookie header: "nexus_admin_session=<token>"
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('nexus_admin_session=')) {
        return decodeURIComponent(cookie.substring('nexus_admin_session='.length));
      }
    }
  }

  return null;
}

/**
 * Middleware: Requires an active, authenticated admin session.
 * Enforces server-side validation against SQLite admin_sessions.
 */
export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  try {
    const token = extractToken(req);
    if (!token) {
      throw new AppError(401, 'Authentication required to access this resource', undefined, 'UNAUTHENTICATED');
    }

    const tokenHash = hashToken(token);
    const session = adminSessionsRepository.findActiveSession(tokenHash);

    if (!session) {
      throw new AppError(401, 'Invalid or expired administrative session', undefined, 'INVALID_SESSION');
    }

    req.admin = session;
    req.sessionToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Backward compatibility alias for requireAdminSession
 */
export const requireAuth = requireAdminSession;

/**
 * Middleware: Requires super_admin role specifically.
 */
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.admin) {
    return next(new AppError(401, 'Authentication required', undefined, 'UNAUTHENTICATED'));
  }

  if (req.admin.role !== 'super_admin') {
    return next(
      new AppError(403, 'Forbidden: This action requires super_admin permissions', undefined, 'INSUFFICIENT_PERMISSIONS')
    );
  }

  next();
}

/**
 * Middleware: Requires one of the specified roles.
 */
export function requireRole(allowedRoles: AdminRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.admin) {
      return next(new AppError(401, 'Authentication required', undefined, 'UNAUTHENTICATED'));
    }

    if (!allowedRoles.includes(req.admin.role)) {
      return next(
        new AppError(
          403,
          `Forbidden: Requires one of [${allowedRoles.join(', ')}] permissions`,
          undefined,
          'INSUFFICIENT_PERMISSIONS'
        )
      );
    }

    next();
  };
}

// In-memory IP rate limiter for login brute force prevention
const ipLoginAttempts = new Map<string, { count: number; firstAttempt: number }>();
const IP_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 mins
const IP_RATE_LIMIT_MAX_ATTEMPTS = 15;

export function checkIpLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipLoginAttempts.get(ip);

  if (!record || now - record.firstAttempt > IP_RATE_LIMIT_WINDOW_MS) {
    ipLoginAttempts.set(ip, { count: 1, firstAttempt: now });
    return true;
  }

  if (record.count >= IP_RATE_LIMIT_MAX_ATTEMPTS) {
    return false;
  }

  record.count += 1;
  return true;
}

export function resetIpLoginRateLimit(ip: string): void {
  ipLoginAttempts.delete(ip);
}
