import { Request, Response, NextFunction } from 'express';
import { adminUsersRepository } from '../../db/repositories/adminUsers.repository.ts';
import { adminSessionsRepository } from '../../db/repositories/adminSessions.repository.ts';
import { verifyPassword, generateSessionToken, hashToken } from '../../utils/crypto.ts';
import { checkIpLoginRateLimit, resetIpLoginRateLimit, extractToken } from '../../middleware/auth.ts';
import { auditService } from '../../services/audit.service.ts';
import { AppError } from '../../middleware/errorHandler.ts';
import { apiSuccess } from '../../utils/apiResponse.ts';
import { config } from '../../config/index.ts';

export class AdminAuthController {
  public async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const ip = (req.ip || req.socket.remoteAddress || 'unknown').toString();

      // 1. Check IP-level rate limiting
      if (!checkIpLoginRateLimit(ip)) {
        throw new AppError(429, 'Too many login attempts from this IP. Please wait 15 minutes.', undefined, 'RATE_LIMITED');
      }

      const { email, password } = req.body;
      if (!password || typeof password !== 'string') {
        throw new AppError(400, 'Password is required', undefined, 'INVALID_PASSWORD');
      }

      // 2. Fetch target admin user
      // If email is provided, authenticate specific user (backward compatible with RBAC tests)
      // If email is omitted, enforce One-Password model (NEXUS Admin Portal standard)
      let user = null;
      if (email && typeof email === 'string') {
        if (!email.includes('@')) {
          throw new AppError(400, 'A valid email address is required', undefined, 'INVALID_EMAIL');
        }
        user = adminUsersRepository.findByEmail(email);
      } else {
        // One-Password model: resolves the primary super administrator
        user =
          adminUsersRepository.findByEmail(config.admin.defaultUsername) ||
          adminUsersRepository.listAllSafe()[0] ||
          null;
        if (user && !('password_hash' in user)) {
          // If returned from listAllSafe, retrieve full record with credentials
          user = adminUsersRepository.findById(user.id);
        }
      }

      if (!user) {
        // Obscure whether user was missing or credentials failed
        throw new AppError(401, 'Invalid credentials.', undefined, 'INVALID_CREDENTIALS');
      }

      // 3. Check account status
      if (user.status !== 'active') {
        throw new AppError(403, `Account is ${user.status}. Access denied.`, undefined, 'ACCOUNT_INACTIVE');
      }

      // 4. Check lockout status
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / (60 * 1000));
        throw new AppError(
          423,
          `Account is temporarily locked due to excessive failed attempts. Please try again in ${remainingMinutes} minute(s).`,
          undefined,
          'ACCOUNT_LOCKED'
        );
      }

      // 5. Verify password
      // If environment secret ADMIN_PASSWORD_HASH is set (<hash>:<salt>) and no specific email requested:
      let isMatch = false;
      if (!email && config.admin.passwordHash && config.admin.passwordHash.includes(':')) {
        const [envHash, envSalt] = config.admin.passwordHash.split(':');
        isMatch = await verifyPassword(password, envHash, envSalt);
      } else {
        isMatch = await verifyPassword(password, user.password_hash, user.salt);
      }

      if (!isMatch) {
        const { locked, lockedUntil } = adminUsersRepository.incrementFailedAttempts(user.id, 5, 15);
        auditService.log(
          {
            adminId: user.id,
            adminName: user.name,
            adminRole: user.role,
            action: 'LOGIN_FAILED',
            entityType: 'ADMIN_USER',
            entityId: user.id,
            details: { reason: 'Incorrect password', locked, lockedUntil },
          },
          req
        );

        if (locked) {
          throw new AppError(
            423,
            'Account has been temporarily locked for 15 minutes due to 5 consecutive failed attempts.',
            undefined,
            'ACCOUNT_LOCKED'
          );
        }

        throw new AppError(401, 'Invalid credentials.', undefined, 'INVALID_CREDENTIALS');
      }

      // 6. Login succeeded: reset counters, record timestamp
      adminUsersRepository.resetFailedAttemptsAndRecordLogin(user.id);
      resetIpLoginRateLimit(ip);

      // 7. Create Session
      const sessionId = `sess-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
      const { token, tokenHash } = generateSessionToken();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

      adminSessionsRepository.createSession(
        sessionId,
        user.id,
        tokenHash,
        expiresAt,
        ip,
        req.headers['user-agent'] || null
      );

      // 8. Set HttpOnly Cookie (Path=/ so all admin and api requests inherit session)
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('nexus_admin_session', token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        path: '/',
        maxAge: 24 * 60 * 60 * 1000,
      });

      // 9. Audit log
      auditService.log(
        {
          adminId: user.id,
          adminName: user.name,
          adminRole: user.role,
          action: 'LOGIN_SUCCESS',
          entityType: 'ADMIN_USER',
          entityId: user.id,
          details: { sessionId, expiresAt },
        },
        req
      );

      const safeUser = adminUsersRepository.findSafeById(user.id);

      res.status(200).json(
        apiSuccess(
          {
            user: safeUser,
            token, // Provided for clients using Authorization: Bearer
            expiresAt,
          },
          {
            message: 'Administrative authentication successful',
          }
        )
      );
    } catch (err) {
      next(err);
    }
  }

  public async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token = extractToken(req);
      if (token) {
        const tokenHash = hashToken(token);
        adminSessionsRepository.deleteByTokenHash(tokenHash);
      }

      if (req.admin) {
        auditService.log(
          {
            adminId: req.admin.adminId,
            adminName: req.admin.name,
            adminRole: req.admin.role,
            action: 'LOGOUT',
            entityType: 'ADMIN_USER',
            entityId: req.admin.adminId,
            details: { sessionId: req.admin.sessionId },
          },
          req
        );
      }

      res.clearCookie('nexus_admin_session', { path: '/' });
      res.clearCookie('nexus_admin_session', { path: '/api' });

      res.status(200).json(
        apiSuccess(
          { loggedOut: true },
          {
            message: 'Administrative session terminated successfully',
          }
        )
      );
    } catch (err) {
      next(err);
    }
  }

  public async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.admin) {
        throw new AppError(401, 'Authentication required', undefined, 'UNAUTHENTICATED');
      }

      const safeUser = adminUsersRepository.findSafeById(req.admin.adminId);
      if (!safeUser) {
        throw new AppError(404, 'Admin user record not found', undefined, 'USER_NOT_FOUND');
      }

      const permissions =
        req.admin.role === 'super_admin'
          ? [
              'manage_admins',
              'manage_all_content',
              'publish_unpublish',
              'delete_archive_content',
              'modify_site_settings',
              'view_audit_logs',
            ]
          : [
              'create_edit_projects',
              'create_edit_events',
              'manage_announcements',
              'manage_archive',
              'manage_resources',
              'manage_media',
            ];

      res.status(200).json(
        apiSuccess({
          user: safeUser,
          role: req.admin.role,
          permissions,
          session: {
            sessionId: req.admin.sessionId,
            expiresAt: req.admin.expiresAt,
          },
        })
      );
    } catch (err) {
      next(err);
    }
  }
}

export const adminAuthController = new AdminAuthController();
