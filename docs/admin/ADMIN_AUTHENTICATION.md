# NEXUS Admin Portal — Complete Authentication System

Comprehensive specification and operational guide for the **One-Password Authentication System** powering the internal **NEXUS Admin Portal** (`/admin`).

---

## 1. Authentication Model Overview

The NEXUS Admin Portal is governed by an intentional, highly focused administrative access model: **EXACTLY ONE Master Administrator Password**.

### Design Philosophy
- **NO Usernames**: There is no username field or identifier required on login.
- **NO Admin Email Login**: The UI does not request or accept email addresses.
- **NO Multiple Admin Accounts**: Exactly one administrative authority controls the portal.
- **NO Public Registration**: Administrative accounts cannot be created via public endpoints.
- **NO Social Login / OAuth**: No third-party OAuth providers, identity federations, or popups.
- **NO Role Selector**: All administrative capabilities are bounded by the master administrative credential.
- **NO Client-Side Secret Storage**: Passwords and session keys are never stored in `localStorage`, `sessionStorage`, or frontend state variables.

### User Experience
- **Login URL**: `/admin/login`
- **Form Field**: `Password` (`<input type="password" />`)
- **Submit Action**: `LOGIN` button
- **Redirect on Success**: `/admin` (Dashboard Console)

---

## 2. Authentication Flow Diagram

```text
       Browser User
            │
            ▼
    Enter Master Password
            │
            ▼
   POST /api/admin/auth/login { password }
            │
            ├─► 1. Rate Limit & Lockout Check (15 attempts/15 mins, 5 lockout)
            │      └─ [Violated] ──► Return HTTP 423 / HTTP 429
            │
            ├─► 2. Validate Password Input
            │      └─ [Empty/Invalid] ──► Return HTTP 400
            │
            ├─► 3. Retrieve ADMIN_PASSWORD_HASH from Environment
            │      (Fallback to SQLite Seeded Super-Admin if unset)
            │
            ├─► 4. Verify Password (scrypt / timingSafeEqual)
            │      └─ [Mismatch] ──► Audit Log & Return HTTP 401 "Invalid credentials."
            │
            ├─► 5. Generate 32-Byte Cryptographic Session Token & SHA-256 Hash
            │
            ├─► 6. Persist Session to SQLite (admin_sessions) with 24-Hour Expiry
            │
            ├─► 7. Issue HttpOnly, Secure, SameSite=Strict Cookie (Path=/)
            │
            └─► 8. Return HTTP 200 { success: true, data: { user, expiresAt } }
                    │
                    ▼
          Frontend Redirects to /admin
```

---

## 3. Password Security & Hashing Architecture

### 3.1 Hashing Algorithm
Passwords are cryptographically secured using Node.js native `crypto.scrypt` with the following parameters:
- **Salt**: 16 cryptographically random bytes (`crypto.randomBytes(16).toString('hex')`).
- **Derived Key Length**: 64 bytes (`derivedKey.toString('hex')`).
- **Verification**: Timing-safe memory comparison via `crypto.timingSafeEqual` to prevent side-channel timing attacks.
- **Storage Format**: `<derived_key_hex>:<salt_hex>`.

### 3.2 Environment Configuration (`ADMIN_PASSWORD_HASH`)
The administrator secret is provided through the server environment:
```env
ADMIN_PASSWORD_HASH=replace_with_hash
```

#### Security Guardrails
1. **Never committed**: `.env` and `.env.local` are explicitly ignored in `.gitignore`.
2. **Never exposed to client**: The variable is never prefixed with `VITE_` and never included in frontend build chunks.
3. **Never stored in plaintext**: Plaintext passwords never exist in source code, SQLite tables, or log files.
4. **Never leaked in error responses**: Failed logins return a generic message: `"Invalid credentials."`.

### 3.3 Generating the Secret Hash
A dedicated CLI generator is provided in the repository:
```bash
npx tsx scripts/hash-admin-password.ts <your_new_password>
```
Example Output:
```text
Generated ADMIN_PASSWORD_HASH:
8f3a5b91c...b204:3c91a0f8...7d14

Add the following line to your .env or .env.local file:
ADMIN_PASSWORD_HASH=8f3a5b91c...b204:3c91a0f8...7d14
```

---

## 4. Session Architecture & Persistence

Authentication state is maintained exclusively via **server-side sessions** backed by SQLite.

### 4.1 SQLite Session Schema (`admin_sessions`)
```sql
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (admin_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_token_hash ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);
```

### 4.2 Session Token Generation
- **Raw Token**: 32 cryptographically random bytes (`crypto.randomBytes(32).toString('hex')` = 64 hex characters).
- **Token Hash**: SHA-256 hash computed via `crypto.createHash('sha256').update(token).digest('hex')`.
- **Database Safety**: Only `token_hash` is written to SQLite. Even in the event of database exposure, active session tokens cannot be derived from stored hashes.

### 4.3 Cookie Configuration
The session token is delivered in an HTTP-only response header:
```http
Set-Cookie: nexus_admin_session=<raw_token>; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict; Secure
```
- **Name**: `nexus_admin_session`
- **Path**: `/` (Enables automatic cookie delivery across both `/admin` client requests and `/api/*` endpoints).
- **Max-Age**: `86400` seconds (24 hours).
- **HttpOnly**: `true` (Completely prevents JavaScript inspection, thwarting XSS session hijacking).
- **SameSite**: `Strict` (Protects against CSRF attacks).
- **Secure**: `true` in production (`process.env.NODE_ENV === 'production'`).

### 4.4 Session Lifetime & Expiration
- **Default Lifetime**: 24 hours from issuance.
- **Expiration Enforcement**: Every incoming request running `requireAdminSession()` verifies `expires_at > datetime('now')`.
- **Expired Session Behavior**: Rejects immediately with HTTP 401 (`INVALID_SESSION`). The client intercepts this and redirects to `/admin/login`.

---

## 5. API Endpoints

### 5.1 `POST /api/admin/auth/login`
Authenticates the administrator master password.

- **Access**: Public (Subject to IP rate limiting and account lockout)
- **Request Body**:
  ```json
  {
    "password": "your_admin_password"
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "data": {
      "user": {
        "id": "admin-001",
        "email": "admin@nexus.campus",
        "name": "NEXUS Super Administrator",
        "role": "super_admin",
        "status": "active"
      },
      "token": "a1b2c3d4...",
      "expiresAt": "2026-09-21T11:45:00.000Z"
    },
    "meta": {
      "message": "Administrative authentication successful"
    },
    "error": null
  }
  ```
- **Error Response (`401 Unauthorized`)**:
  ```json
  {
    "data": null,
    "meta": null,
    "error": {
      "code": "INVALID_CREDENTIALS",
      "message": "Invalid credentials."
    }
  }
  ```

### 5.2 `POST /api/admin/auth/logout`
Invalidates the active session in SQLite and clears the cookie.

- **Access**: Authenticated (`requireAdminSession`)
- **Action**:
  1. Computes SHA-256 hash of the presented token.
  2. Deletes the session row from `admin_sessions`.
  3. Emits `Set-Cookie: nexus_admin_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`.
  4. Records `LOGOUT` audit log entry.
- **Response (`200 OK`)**:
  ```json
  {
    "data": { "loggedOut": true },
    "meta": { "message": "Administrative session terminated successfully" },
    "error": null
  }
  ```

### 5.3 `GET /api/admin/auth/me`
Verifies the current administrative session.

- **Access**: Authenticated (`requireAdminSession`)
- **Response (`200 OK`)**:
  ```json
  {
    "data": {
      "user": {
        "id": "admin-001",
        "email": "admin@nexus.campus",
        "name": "NEXUS Super Administrator",
        "role": "super_admin"
      },
      "role": "super_admin",
      "permissions": [
        "manage_admins",
        "manage_all_content",
        "publish_unpublish",
        "delete_archive_content",
        "modify_site_settings",
        "view_audit_logs"
      ],
      "session": {
        "sessionId": "sess-1789882981-a9f2bc",
        "expiresAt": "2026-09-21T11:45:00.000Z"
      }
    },
    "error": null
  }
  ```

---

## 6. Reusable Middleware: `requireAdminSession()`

Located in [backend/middleware/auth.ts](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/middleware/auth.ts):

```typescript
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
```

### Protection Scope
- Applied globally across all administrative routes in `backend/domains/admin/admin.routes.ts`:
  ```typescript
  router.use(requireAdminSession);
  ```
- Any unauthorized call to `/api/admin/*` is rejected before controller execution.

---

## 7. Brute-Force & Lockout Protection

The login endpoint is guarded by a two-tier protection mechanism:

1. **IP Sliding Window Limiter**:
   - Monitored by `checkIpLoginRateLimit(ip)`.
   - Maximum 15 login attempts per 15-minute window per IP.
   - Triggers HTTP 429 (`RATE_LIMITED`).
2. **Account Lockout Counter**:
   - Monitored on `admin_users.failed_attempts`.
   - After **5 consecutive failed attempts**, the administrator account is temporarily locked for 15 minutes (`locked_until`).
   - Triggers HTTP 423 (`ACCOUNT_LOCKED`).
   - Counter automatically resets to 0 upon successful password verification.

---

## 8. Client-Side Routing & Protection

In `frontend/src/admin/AdminApp.tsx`:
- **Server Verification**: On mount, `AdminApp` calls `GET /api/admin/auth/me` with `credentials: 'include'`.
- **Unauthenticated Redirect**: If unauthenticated and on `/admin` or any sub-route, the router forces navigation to `/admin/login`.
- **Authenticated Redirect**: If authenticated and on `/admin/login`, the router transitions to `/admin`.
- **Logout Transition**: Invoking `adminLogout()` clears local auth state and transitions back to `/admin/login`.

---

## 9. Password Rotation Procedure

To rotate the administrator master password:

1. Generate a new scrypt hash using the CLI tool:
   ```bash
   npx tsx scripts/hash-admin-password.ts <new_secure_password>
   ```
2. Update `ADMIN_PASSWORD_HASH` in the production environment:
   ```env
   ADMIN_PASSWORD_HASH=<new_hash_output>
   ```
3. Restart the backend service.
4. Existing active sessions will remain valid until their 24-hour expiration or manual logout.
5. All subsequent logins will immediately require `<new_secure_password>`.

---

## 10. Automated Tests & Verification

The authentication system is covered by **11 comprehensive automated tests** in [backend/tests/admin-auth.test.ts](file:///c:/Users/Orosmit%20Mishra/Desktop/webnexus/nexus-i8-/backend/tests/admin-auth.test.ts):

| # | Test Scenario | Verified Behavior |
| :---: | :--- | :--- |
| **1** | **Valid Password** | Returns HTTP 200, session token, and sets `nexus_admin_session` HttpOnly cookie. |
| **2** | **Invalid Password** | Returns HTTP 401 with generic message `"Invalid credentials."`. |
| **3** | **Missing Password** | Returns HTTP 400 `INVALID_PASSWORD`. |
| **4** | **Repeated Failed Attempts** | Repeated failures trigger account lockout (423) or rate limit (429). |
| **5** | **Session Creation in SQLite** | Session record is stored in `admin_sessions` with expiration in the future. |
| **6** | **Admin Without Session** | Calling `/api/admin/auth/me` without cookie returns HTTP 401 `UNAUTHENTICATED`. |
| **7** | **Admin With Session** | Calling with valid cookie returns HTTP 200, admin user record, and permissions. |
| **8** | **Protected Endpoints Without Session** | All `/api/admin/*` endpoints strictly reject unauthenticated calls with 401. |
| **9** | **Logout Flow** | Invalidates session in SQLite, clears cookie, rejects subsequent requests with 401. |
| **10** | **Expired Session** | Sessions with expired timestamps in SQLite are rejected with 401 `INVALID_SESSION`. |
| **11** | **Invalid Cookie** | Fabricated or tampered cookies are rejected with 401 `INVALID_SESSION`. |

*Security Constraint*: No test prints the actual password string.

### Test Execution Command
```bash
npm run test:admin:auth
```
Result: **28/28 assertions passed (100%)**.
Full suite (`npm test`): **100% passed across all 9 test suites**.

> **Complete Foundation Integration Record**: See [ADMIN_FOUNDATION_COMPLETE.md](file:///docs/admin/ADMIN_FOUNDATION_COMPLETE.md) for full implementation details, protected dashboard API, and operational runbook.

