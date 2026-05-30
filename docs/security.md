# Security & Authentication

> Authentication system, security middleware, input sanitization, and audit logging.

---

## Table of Contents

- [Authentication System](#authentication-system)
- [Security Middleware Stack](#security-middleware-stack)
- [Rate Limiting](#rate-limiting)
- [Input Sanitization](#input-sanitization)
- [CSRF Protection](#csrf-protection)
- [Cookie Security](#cookie-security)
- [Account Lockout](#account-lockout)
- [Audit Logging](#audit-logging)
- [Security Headers](#security-headers)
- [Frontend Security](#frontend-security)

---

## Authentication System

### Overview

Career Forge uses a **dual-token authentication** system:

| Token             | Type              | Storage               | Lifetime   | Purpose            |
| ----------------- | ----------------- | --------------------- | ---------- | ------------------ |
| **Access Token**  | JWT (HS256)       | Client `localStorage` | 15 minutes | API authorization  |
| **Refresh Token** | Random (64 bytes) | HttpOnly cookie       | 7 days     | Renew access token |

### Access Tokens (JWT)

Created with `python-jose` using HS256 algorithm.

**Payload:**

```json
{
  "sub": "1", // user_id as string
  "type": "access", // token type guard
  "iat": 1707830400, // issued at
  "exp": 1707831300 // expires in 15 min
}
```

**Type validation**: The system verifies `type: "access"` to prevent refresh tokens from being used as access tokens.

### Refresh Tokens

- Generated with `secrets.token_urlsafe(64)` (cryptographically secure)
- **Never stored in plaintext** — only SHA-256 hash stored in the database
- Delivered via HttpOnly cookie (path restricted to `/api/auth`)
- Fallback: can be sent in request body (for non-browser clients)

### Token Rotation

Each token refresh creates a new refresh token and invalidates the old one:

```
1. Client sends refresh_token=ABC
2. Server: hash(ABC) → find in DB
3. Server: verify not expired, not revoked
4. Server: mark ABC with used_at = now()
5. Server: create new token DEF, store hash(DEF)
6. Server: return new access_token + Set-Cookie: refresh_token=DEF
```

### Token Reuse Detection

If a previously-used token is presented (indicating possible theft):

```
1. Client sends refresh_token=ABC (already used)
2. Server: hash(ABC) → found in DB, but used_at IS NOT NULL
3. Server: ⚠ POTENTIAL TOKEN THEFT
4. Server: revoke ALL refresh tokens for this user
5. Server: log CRITICAL audit event
6. Server: return 401 Unauthorized
```

This forces the legitimate user to re-authenticate while blocking the attacker.

### Password Security

- Hashing: **bcrypt** with automatic salt generation
- Validation rules (registration):
  - Minimum 8 characters
  - At least 1 uppercase letter
  - At least 1 lowercase letter
  - At least 1 digit
  - At least 1 special character

---

## Security Middleware Stack

Seven middleware layers process every request in order:

Implementation note: `app/security.py` is a compatibility facade. The concrete
implementation is split under `app/security_layers/` into rate limiting,
account lockout, middleware, CSRF, and sanitization modules. Existing imports
such as `from app.security import InputSanitizer` and
`setup_security_middleware` remain stable.

### 1. TrustedHostMiddleware

Prevents host header injection attacks.

- Active when `TRUSTED_HOSTS` is configured
- Rejects requests with untrusted `Host` headers
- Prevents DNS rebinding attacks

### 2. HTTPSRedirectMiddleware

Forces HTTPS in production.

- Active when `ENFORCE_HTTPS=true`
- Redirects HTTP → HTTPS (301)
- Respects `X-Forwarded-Proto` header (for reverse proxies)

### 3. RequestSizeLimitMiddleware

DoS prevention via request body size limiting.

- Maximum: **10 MB** per request
- Returns `413 Request Entity Too Large` if exceeded

### 4. RateLimitMiddleware

Per-IP request rate limiting with separate limits for auth endpoints.

| Scope                          | Default Limit      |
| ------------------------------ | ------------------ |
| General API                    | 60 requests/minute |
| Auth endpoints (`/api/auth/*`) | 10 requests/minute |

- Sliding window algorithm
- Supports in-memory and Redis backends
- Returns `429 Too Many Requests` with `Retry-After` header
- Rate limit violations are audit-logged

### 5. ContentTypeValidationMiddleware

Enforces proper content types on state-changing requests.

- Requires `Content-Type: application/json` for POST, PUT, PATCH on `/api/*`
- Exemptions: OAuth2 login endpoint (form-data), file uploads (multipart)
- Returns `415 Unsupported Media Type` if invalid

### 6. CSRFMiddleware

Cross-Site Request Forgery protection.

- Validates `Origin` header on state-changing requests (POST, PUT, PATCH, DELETE)
- Compares against configured `CORS_ORIGINS`
- Combined with `SameSite` cookie attribute for defense in depth

### 7. SecurityHeadersMiddleware

Adds OWASP-recommended security headers to every response.

(See [Security Headers](#security-headers) section below.)

---

## Rate Limiting

### Backends

| Backend       | Use Case                   | Configuration                            |
| ------------- | -------------------------- | ---------------------------------------- |
| **In-Memory** | Development, single server | `RATE_LIMIT_BACKEND=memory` (default)    |
| **Redis**     | Production, multi-server   | `RATE_LIMIT_BACKEND=redis` + `REDIS_URL` |

### FallbackRateLimiter

The system uses a `FallbackRateLimiter` that automatically falls back from Redis to in-memory if Redis becomes unavailable. This ensures the application continues to function even if Redis goes down.

### Response Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1707830460
```

### Configuration

```env
RATE_LIMIT_PER_MINUTE=60
RATE_LIMIT_AUTH_PER_MINUTE=10
RATE_LIMIT_BACKEND=redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-password
```

---

## Input Sanitization

### Server-Side (bleach)

The `InputSanitizer` class provides multi-level sanitization:

**HTML Sanitization** — Safe tag whitelist:

```python
SAFE_TAGS = ['b', 'i', 'u', 'strong', 'em', 'br', 'p', 'ul', 'ol', 'li', 'a', 'span']
```

**Dangerous Pattern Detection:**

- `<script>` tags and JavaScript URLs
- `on*` event handlers (onclick, onerror, etc.)
- `data:` URLs, `vbscript:` URLs
- CSS `expression()` calls
- `javascript:` in any context

**String Sanitization:**

- HTML escaping (`<`, `>`, `&`, `"`, `'`)
- Null byte removal
- Whitespace trimming

**Dict Sanitization:**

- Recursive sanitization of nested objects
- Field-level control over which fields allow safe HTML
- Applied to all CV data on create/update

**Filename Sanitization:**

- Path traversal prevention (strips `../`, `..\\`)
- Special character removal
- Length limiting

### Client-Side (DOMPurify)

`EditableText` components sanitize all input and pasted content:

```javascript
import DOMPurify from "dompurify";

const clean = DOMPurify.sanitize(dirty, {
  ALLOWED_TAGS: [
    "b",
    "i",
    "u",
    "strong",
    "em",
    "br",
    "p",
    "ul",
    "ol",
    "li",
    "a",
    "span",
    "div",
  ],
});
```

---

## CSRF Protection

### Origin Validation

The CSRFMiddleware validates the `Origin` header on all state-changing requests:

1. Extract `Origin` from request headers
2. Compare against `CORS_ORIGINS` allowlist
3. Reject if not matching

### SameSite Cookie

Refresh token cookies use `SameSite` attribute:

| Environment | SameSite          | Effect                                           |
| ----------- | ----------------- | ------------------------------------------------ |
| Development | `Lax`             | Cookie sent on same-site + top-level navigations |
| Production  | `Strict` or `Lax` | Configurable via `COOKIE_SAMESITE`               |

### Defense in Depth

CSRF is prevented through multiple layers:

1. Origin header validation
2. SameSite cookie attribute
3. Content-Type enforcement (blocks simple form submissions)
4. CORS policy (only allows configured origins)

---

## Cookie Security

Refresh token cookies are configured with all security attributes:

| Attribute  | Value                            | Purpose                                        |
| ---------- | -------------------------------- | ---------------------------------------------- |
| `HttpOnly` | `true`                           | Not accessible via JavaScript (XSS mitigation) |
| `Secure`   | Configurable (`COOKIE_SECURE`)   | HTTPS-only transmission                        |
| `SameSite` | Configurable (`COOKIE_SAMESITE`) | CSRF mitigation                                |
| `Path`     | `/api/auth`                      | Only sent to auth endpoints                    |
| `Domain`   | Configurable (`COOKIE_DOMAIN`)   | Scope restriction                              |
| `Max-Age`  | 604800 (7 days)                  | Token lifetime                                 |

---

## Account Lockout

Brute-force protection via account lockout after repeated failed login attempts.

| Setting                    | Default | Description                        |
| -------------------------- | ------- | ---------------------------------- |
| `ACCOUNT_LOCKOUT_ATTEMPTS` | 10      | Max failed attempts before lockout |
| `ACCOUNT_LOCKOUT_DURATION` | 15      | Lockout duration in minutes        |

**Behavior:**

1. Each failed login increments the attempt counter for that user
2. After N failed attempts → account is locked for M minutes
3. Lockout event is audit-logged (severity: ALERT)
4. Successful login resets the counter
5. Counter auto-resets after the lockout duration

**Backends:** In-memory (single server) or Redis (distributed).

---

## Audit Logging

### Dual Output

Events are logged to both:

1. **Database** (`audit_logs` table) — For querying, compliance, and incident review
2. **Stdout / File** — For real-time monitoring, log aggregation, and SIEM integration

### Event Types (25 total)

| Category    | Events                                 | Default Severity |
| ----------- | -------------------------------------- | ---------------- |
| **Auth**    | `login_success`                        | INFO             |
|             | `login_failure`                        | WARNING          |
|             | `logout`, `logout_all_devices`         | INFO             |
| **Tokens**  | `token_refresh`                        | INFO             |
|             | `token_refresh_failure`                | WARNING          |
|             | `token_reuse_detected`                 | **CRITICAL**     |
|             | `token_revoked`                        | INFO             |
| **Account** | `account_created`                      | INFO             |
|             | `account_locked`                       | **ALERT**        |
|             | `account_unlocked`                     | INFO             |
|             | `password_changed`                     | WARNING          |
|             | `password_reset_requested/completed`   | WARNING / INFO   |
| **Access**  | `unauthorized_access`                  | WARNING          |
|             | `rate_limit_exceeded`                  | WARNING          |
|             | `suspicious_activity`                  | **ALERT**        |
| **Data**    | `document_created`, `document_deleted` | INFO             |
|             | `document_exported`, `data_exported`   | INFO             |

### Severity Levels

```
INFO → WARNING → ALERT → CRITICAL
```

| Level        | Use Case                                             |
| ------------ | ---------------------------------------------------- |
| **INFO**     | Normal operations (login, logout, CV create)         |
| **WARNING**  | Potential issues (failed login, rate limit hit)      |
| **ALERT**    | Security concerns (account locked, user deactivated) |
| **CRITICAL** | Active threats (token reuse detected)                |

### Logged Data per Event

| Field         | Description                    |
| ------------- | ------------------------------ |
| `timestamp`   | Event time (UTC)               |
| `event_type`  | Event category                 |
| `severity`    | INFO/WARNING/ALERT/CRITICAL    |
| `user_id`     | Associated user (if known)     |
| `user_email`  | User's email (if known)        |
| `description` | Human-readable description     |
| `details`     | Additional JSON data           |
| `ip_address`  | Client IP (from proxy headers) |
| `user_agent`  | Browser/client identifier      |
| `endpoint`    | API endpoint path              |
| `success`     | "true", "false", or null       |

## Security Headers

Every response includes these OWASP-recommended headers:

| Header                      | Value                                          | Purpose                       |
| --------------------------- | ---------------------------------------------- | ----------------------------- |
| `X-Content-Type-Options`    | `nosniff`                                      | Prevent MIME-type sniffing    |
| `X-Frame-Options`           | `DENY`                                         | Prevent clickjacking          |
| `X-XSS-Protection`          | `1; mode=block`                                | Legacy XSS filter             |
| `Referrer-Policy`           | `strict-origin-when-cross-origin`              | Control referrer info         |
| `Permissions-Policy`        | Disables geolocation, camera, microphone, etc. | Restrict browser features     |
| `Content-Security-Policy`   | `default-src 'none'; frame-ancestors 'none'`   | Restrict content loading      |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains`          | Force HTTPS (production only) |
| `Cache-Control`             | `no-store` (auth endpoints only)               | Prevent token caching         |

---

## Frontend Security

### XSS Prevention

- **DOMPurify** sanitization on all `contentEditable` inputs
- **Allowed tags** limit: `b, i, u, strong, em, br, p, ul, ol, li, a, span, div`
- Paste events are intercepted and sanitized
- Server-side double-sanitization with **bleach**

### Token Storage

| Token         | Storage         | Risk Mitigation                      |
| ------------- | --------------- | ------------------------------------ |
| Access Token  | `localStorage`  | Short-lived (15 min), type-validated |
| Refresh Token | HttpOnly cookie | Not accessible to JavaScript         |

### Content Security

- No inline scripts in the application
- External resources loaded from trusted CDNs (Google Fonts, Font Awesome)
- No `eval()` or dynamic code execution
