# API Reference

> Complete REST API documentation for the Career Forge backend.

**Base URL:** `http://localhost:8000/api` (development)

**Content Type:** `application/json` (unless noted otherwise)

**Authentication:** Bearer JWT token in `Authorization` header

---

## Table of Contents

- [Health Check](#health-check)
- [Authentication](#authentication)
- [CVs](#cvs)
- [Admin / Audit](#admin--audit)
- [Static Files](#static-files)
- [Error Responses](#error-responses)
- [Rate Limiting](#rate-limiting)

---

## Health Check

### `GET /`

Root endpoint. Returns API info.

**Response** `200 OK`
```json
{
  "app": "CV App API",
  "version": "1.0.0",
  "status": "running"
}
```

### `GET /api/health`

Health check with environment info.

**Response** `200 OK`
```json
{
  "status": "healthy",
  "environment": "development"
}
```

---

## Authentication

All auth endpoints are prefixed with `/api/auth`.

### `POST /api/auth/register`

Create a new user account.

**Request Body**
```json
{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "SecureP@ss1"
}
```

**Validation Rules:**
- `email` — Valid email format, normalized to lowercase
- `username` — 3–100 chars, only `[a-zA-Z0-9_-]`, sanitized
- `password` — 8+ chars, must include: uppercase, lowercase, digit, special character

**Response** `201 Created`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "is_active": true,
  "theme": "dark",
  "language": "en",
  "created_at": "2026-02-13T12:00:00"
}
```

**Errors:** `400` (email/username taken, validation failure)

---

### `POST /api/auth/login`

Login via OAuth2 form-data (standard OAuth2 password flow).

**Request** `Content-Type: application/x-www-form-urlencoded`
```
username=user@example.com&password=SecureP@ss1
```

> Note: The `username` field accepts an email address.

**Response** `200 OK`
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer"
}
```

Also sets an HttpOnly cookie:
```
Set-Cookie: refresh_token=<random-token>; HttpOnly; Secure; SameSite=Lax; Path=/api/auth; Max-Age=604800
```

**Errors:** `401` (invalid credentials), `403` (account locked), `400` (inactive account)

---

### `POST /api/auth/login/json`

Login via JSON body (alternative to form-data).

**Request Body**
```json
{
  "email": "user@example.com",
  "password": "SecureP@ss1"
}
```

**Response:** Same as `POST /api/auth/login`.

---

### `POST /api/auth/refresh`

Refresh the access token using the refresh token.

**Request:** Refresh token sent via HttpOnly cookie (automatic) or request body:
```json
{
  "refresh_token": "<token>"
}
```

**Response** `200 OK`
```json
{
  "access_token": "eyJhbGci...",
  "token_type": "bearer"
}
```

Also sets a new refresh token cookie (token rotation).

**Errors:** `401` (expired, revoked, or reused token)

> **Token Rotation:** Each refresh invalidates the old token. If a previously-used token is presented, ALL tokens for that user are revoked (theft detection).

---

### `POST /api/auth/logout`

Revoke the current refresh token.

**Request:** Refresh token from cookie or body:
```json
{
  "refresh_token": "<token>"
}
```

**Response** `200 OK`
```json
{
  "message": "Successfully logged out"
}
```

Clears the refresh token cookie.

---

### `POST /api/auth/logout/all`

Revoke ALL refresh tokens for the authenticated user (all devices).

**Headers:** `Authorization: Bearer <access_token>`

**Response** `200 OK`
```json
{
  "message": "Successfully logged out from all devices",
  "revoked_sessions": 3
}
```

---

### `GET /api/auth/me`

Get the current authenticated user's profile.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "is_active": true,
  "theme": "dark",
  "language": "en",
  "created_at": "2026-02-13T12:00:00"
}
```

---

### `PATCH /api/auth/preferences`

Update user preferences (theme, language).

**Headers:** `Authorization: Bearer <access_token>`

**Request Body**
```json
{
  "theme": "light",
  "language": "de"
}
```

**Validation:**
- `theme` — Must be `"dark"` or `"light"`
- `language` — Optional string (e.g., `"en"`, `"de"`)

**Response** `200 OK`
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "is_active": true,
  "theme": "light",
  "language": "de",
  "created_at": "2026-02-13T12:00:00"
}
```

---

## CVs

All CV endpoints are prefixed with `/api/cvs`. All require `Authorization: Bearer <access_token>`.

### `POST /api/cvs/`

Create a new CV.

**Request Body**
```json
{
  "title": "My Professional Resume",
  "data": "{\"name\":\"John Doe\",\"position\":\"Software Engineer\",...}"
}
```

> `data` is a JSON string containing the full CV content.

**Response** `201 Created`
```json
{
  "id": 1,
  "title": "My Professional Resume",
  "data": "{...}",
  "is_default": false,
  "profile_image": null,
  "created_at": "2026-02-13T12:00:00",
  "updated_at": "2026-02-13T12:00:00"
}
```

---

### `GET /api/cvs/`

List all CVs for the authenticated user (lightweight — no `data` field).

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "title": "My Professional Resume",
    "is_default": true,
    "profile_image": null,
    "created_at": "2026-02-13T12:00:00",
    "updated_at": "2026-02-13T14:30:00"
  },
  {
    "id": 2,
    "title": "Cover Letter - Acme Corp",
    "is_default": false,
    "profile_image": null,
    "created_at": "2026-02-13T13:00:00",
    "updated_at": "2026-02-13T13:00:00"
  }
]
```

---

### `GET /api/cvs/{cv_id}`

Get a specific CV with full data.

**Response** `200 OK`
```json
{
  "id": 1,
  "title": "My Professional Resume",
  "data": "{\"name\":\"John Doe\",...}",
  "is_default": true,
  "profile_image": "abc123.jpg",
  "created_at": "2026-02-13T12:00:00",
  "updated_at": "2026-02-13T14:30:00"
}
```

**Errors:** `404` (not found or not owned by user)

---

### `PUT /api/cvs/{cv_id}`

Update a CV.

**Request Body**
```json
{
  "title": "Updated Resume Title",
  "data": "{...}",
  "is_default": true
}
```

All fields are optional. Setting `is_default: true` clears the default flag on all other CVs.

**Response** `200 OK` — Updated CV object.

---

### `DELETE /api/cvs/{cv_id}`

Delete a CV.

**Response** `204 No Content`

---

### `GET /api/cvs/default/current`

Get the user's default CV, or the most recently updated CV if no default is set.

**Response** `200 OK` — Full CV object.

**Errors:** `404` (no CVs exist)

---

### `GET /api/cvs/{cv_id}/export`

Export a CV as JSON with export metadata.

**Response** `200 OK`
```json
{
  "title": "My Professional Resume",
  "data": "{...}",
  "exported_at": "2026-02-13T15:00:00"
}
```

---

### `POST /api/cvs/import`

Import a CV from exported JSON data.

**Request Body**
```json
{
  "title": "Imported Resume",
  "data": "{...}"
}
```

**Response** `201 Created` — New CV object.

---

### `POST /api/cvs/{cv_id}/duplicate`

Create a copy of an existing CV.

**Response** `201 Created`
```json
{
  "id": 3,
  "title": "My Professional Resume (Copy)",
  "data": "{...}",
  "is_default": false,
  ...
}
```

---

### `POST /api/cvs/{cv_id}/upload-image`

Upload a profile image for a CV.

**Request** `Content-Type: multipart/form-data`
```
file: <image-file>
```

**Validation:** File must be an image (JPEG, PNG, GIF, WebP).

**Response** `200 OK`
```json
{
  "profile_image": "uuid-filename.jpg",
  "message": "Image uploaded successfully"
}
```

Uploaded files are served from `/uploads/profile_images/`.

---

## Admin / Audit

All admin endpoints require `Authorization: Bearer <access_token>` with an admin user (`is_admin=true`).

### `GET /api/admin/audit/logs`

Query audit logs with filtering and pagination.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `event_type` | string | Filter by event type |
| `severity` | string | Filter by severity (info/warning/alert/critical) |
| `user_id` | integer | Filter by user ID |
| `user_email` | string | Filter by user email (partial match) |
| `ip_address` | string | Filter by IP address |
| `success` | string | Filter by success status (true/false) |
| `start_date` | datetime | Filter from date |
| `end_date` | datetime | Filter to date |
| `skip` | integer | Pagination offset (default: 0) |
| `limit` | integer | Page size (default: 50, max: 100) |

**Response** `200 OK`
```json
{
  "logs": [...],
  "total": 1250,
  "skip": 0,
  "limit": 50
}
```

---

### `GET /api/admin/audit/stats`

Security statistics dashboard.

**Response** `200 OK`
```json
{
  "total_events": 1250,
  "today_logins": 45,
  "today_failures": 3,
  "lockouts": 1,
  "token_reuse_events": 0,
  "critical_events": 0
}
```

---

### `GET /api/admin/audit/event-types`

List all available event types and severity levels.

**Response** `200 OK`
```json
{
  "event_types": ["login_success", "login_failure", ...],
  "severity_levels": ["info", "warning", "alert", "critical"]
}
```

---

### `GET /api/admin/audit/recent-alerts`

Recent warning-and-above events.

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `hours` | integer | 24 | Lookback period (max: 168) |

**Response** `200 OK`
```json
{
  "alerts": [...],
  "period_hours": 24,
  "total": 5
}
```

---

### `GET /api/admin/audit/user/{user_id}`

Complete audit trail for a specific user.

**Query Parameters:** `skip`, `limit`

**Response** `200 OK`
```json
{
  "user_id": 1,
  "logs": [...],
  "total": 89
}
```

---

### `GET /api/admin/audit/ip/{ip_address}`

All events from a specific IP address.

**Query Parameters:** `skip`, `limit`

**Response** `200 OK`
```json
{
  "ip_address": "192.168.1.1",
  "logs": [...],
  "total": 42,
  "unique_users": 2
}
```

---

## Static Files

| Path | Description |
|------|-------------|
| `/uploads/profile_images/{filename}` | Uploaded profile images |

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error description"
}
```

| Status Code | Meaning |
|-------------|---------|
| `400` | Bad request (validation failure, duplicate email/username) |
| `401` | Unauthorized (invalid/expired token) |
| `403` | Forbidden (account locked, insufficient permissions) |
| `404` | Resource not found |
| `413` | Request body too large (> 10 MB) |
| `422` | Validation error (Pydantic) |
| `429` | Rate limit exceeded |
| `500` | Internal server error |

---

## Rate Limiting

Requests are rate-limited per IP address:

| Scope | Limit | Window |
|-------|-------|--------|
| General API | 60 requests | per minute |
| Auth endpoints (`/api/auth/*`) | 10 requests | per minute |

Response headers on every request:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
X-RateLimit-Reset: 1707830400
```

When exceeded:
```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```
