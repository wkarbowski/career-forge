# API Reference

> Complete REST API documentation for the Career Forge backend.

**Base URL:** `http://localhost:8000/api` (development)

The root service-info endpoint is mounted at `http://localhost:8000/`.

**Content Type:** `application/json` (unless noted otherwise)

**Authentication:** Bearer JWT token in `Authorization` header

---

## Table of Contents

- [Health Check](#health-check)
- [Authentication](#authentication)
- [Documents](#documents)
- [Document Versions](#document-versions)
- [Document Sharing](#document-sharing)
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
  "message": "Career Forge API",
  "version": "1.0.0",
  "docs": "/api/docs"
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
  "token_type": "bearer",
  "expires_in": 900
}
```

Also sets an HttpOnly cookie:

```
Set-Cookie: refresh_token=<random-token>; HttpOnly; SameSite=Lax; Path=/api/auth; Max-Age=604800
```

The `Secure` cookie attribute is added when `COOKIE_SECURE=true`.

**Errors:** `401` (invalid credentials), `429` (account locked or rate limited), `400` (inactive account)

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
  "token_type": "bearer",
  "expires_in": 900
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
  "sessions_revoked": 3
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

### `POST /api/auth/change-password`

Change password for the authenticated user. Requires the current password.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body**

```json
{
  "current_password": "OldP@ss1",
  "new_password": "NewSecureP@ss2"
}
```

**Validation:** `new_password` — 8+ chars, must include: uppercase, lowercase, digit, special character.

**Response** `200 OK`

```json
{
  "message": "Password updated successfully"
}
```

**Errors:** `400` (current password incorrect, validation failure)

---

### `POST /api/auth/forgot-password`

Request a password reset for the given email. If SMTP is configured, Career Forge sends a reset link to the account email. If SMTP is not configured, the request is recorded in the audit log for operator follow-up.

**Request Body** (no auth required)

```json
{
  "email": "user@example.com"
}
```

**Response** `200 OK`

```json
{
  "message": "If an account with that email exists, a password reset request has been recorded."
}
```

Always returns `200` regardless of whether the email exists (prevents user enumeration).

---

### `POST /api/auth/reset-password`

Reset a user's password using a valid reset token from the password reset link.

**Request Body** (no auth required)

```json
{
  "token": "<reset-token>",
  "new_password": "NewSecureP@ss2"
}
```

**Validation:** `new_password` — 8+ chars, must include: uppercase, lowercase, digit, special character.

**Response** `200 OK`

```json
{
  "message": "Password has been reset successfully"
}
```

**Errors:** `400` (invalid/expired token, validation failure)

> On success, all existing refresh tokens for the user are revoked.

---

### `DELETE /api/auth/me`

Delete the authenticated user's account and all associated data.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `204 No Content`

---

## Documents

All document endpoints are prefixed with `/api/documents`. All require `Authorization: Bearer <access_token>`.

### `POST /api/documents/`

Create a new document.

**Request Body**

```json
{
  "title": "My Professional Resume",
  "document_type": "resume",
  "data": {
    "data": {
      "name": "John Doe",
      "position": "Software Engineer"
    }
  }
}
```

> `data` is a JSON object containing the full document content and editor state.

**Response** `201 Created`

```json
{
  "id": 1,
  "title": "My Professional Resume",
  "document_type": "resume",
  "data": { "...": "..." },
  "owner_id": 1,
  "is_default": false,
  "share_token": null,
  "linked_resume_id": null,
  "created_at": "2026-02-13T12:00:00",
  "updated_at": "2026-02-13T12:00:00"
}
```

---

### `GET /api/documents/`

List all documents for the authenticated user (lightweight — no `data` field).

Optional query parameter: `document_type=resume` or `document_type=cover_letter`.

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "title": "My Professional Resume",
    "document_type": "resume",
    "owner_id": 1,
    "is_default": true,
    "share_token": null,
    "linked_resume_id": null,
    "created_at": "2026-02-13T12:00:00",
    "updated_at": "2026-02-13T14:30:00",
    "job_title": "Software Engineer",
    "document_name": "John Doe"
  },
  {
    "id": 2,
    "title": "Cover Letter - Acme Corp",
    "document_type": "cover_letter",
    "owner_id": 1,
    "is_default": false,
    "share_token": null,
    "linked_resume_id": 1,
    "created_at": "2026-02-13T13:00:00",
    "updated_at": "2026-02-13T13:00:00",
    "job_title": null,
    "document_name": null
  }
]
```

---

### `GET /api/documents/{document_id}`

Get a specific document with full data.

**Response** `200 OK`

```json
{
  "id": 1,
  "title": "My Professional Resume",
  "document_type": "resume",
  "data": { "...": "..." },
  "owner_id": 1,
  "is_default": true,
  "share_token": null,
  "linked_resume_id": null,
  "created_at": "2026-02-13T12:00:00",
  "updated_at": "2026-02-13T14:30:00"
}
```

**Errors:** `404` (not found or not owned by user)

---

### `PUT /api/documents/{document_id}`

Update a document.

**Request Body**

```json
{
  "title": "Updated Resume Title",
  "data": { "...": "..." },
  "is_default": true
}
```

All fields are optional. Setting `is_default: true` clears the default flag on all other documents.

**Response** `200 OK` — Updated document object.

---

### `DELETE /api/documents/{document_id}`

Delete a document.

**Response** `204 No Content`

---

### `GET /api/documents/default/current`

Get the user's default document, or the most recently updated document if no default is set.

**Response** `200 OK` — Full document object.

**Errors:** `404` (no documents exist)

---

### `GET /api/documents/{document_id}/export`

Export a saved backend document as JSON with export metadata. Editor-level JSON exports additionally support content-only and content-with-appearance payloads.

**Response** `200 OK`

```json
{
  "title": "My Professional Resume",
  "document_type": "resume",
  "data": { "...": "..." },
  "exported_at": "2026-02-13T15:00:00"
}
```

---

### `POST /api/documents/import`

Import a document from exported JSON data.

**Request Body**

```json
{
  "title": "Imported Resume",
  "document_type": "resume",
  "data": { "...": "..." }
}
```

**Response** `201 Created` — New document object.

---

### `POST /api/documents/{document_id}/duplicate`

Create a copy of an existing document.

**Response** `201 Created`

```json
{
  "id": 3,
  "title": "My Professional Resume (Copy)",
  "document_type": "resume",
  "data": { "...": "..." },
  "is_default": false,
  ...
}
```

---

### `POST /api/documents/{document_id}/upload-image`

Upload a profile image for a document.

**Request** `Content-Type: multipart/form-data`

```
file: <image-file>
```

**Validation:** File must be an image (JPEG, PNG, GIF, WebP).

**Response** `200 OK`

```json
{
  "url": "/uploads/profile_images/doc_1_1770000000.jpg"
}
```

Uploaded files are served from `/uploads/profile_images/`.

---

### `DELETE /api/documents/{document_id}/profile-image`

Remove a document's profile image.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `204 No Content`

---

### `POST /api/documents/{document_id}/versions`

Create a named snapshot of the current document state.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body**

```json
{
  "version_name": "Before Job Fair 2026"
}
```

**Response** `201 Created`

```json
{
  "id": 1,
  "version_name": "Before Job Fair 2026",
  "created_at": "2026-02-13T16:00:00"
}
```

**Errors:** `400` (20-version limit per document reached)

---

### `GET /api/documents/{document_id}/versions`

List all saved versions of a document.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `200 OK`

```json
[
  {
    "id": 1,
    "version_name": "Before Job Fair 2026",
    "created_at": "2026-02-13T16:00:00"
  }
]
```

---

### `GET /api/documents/{document_id}/versions/{version_id}`

Get a specific version with full data.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `200 OK`

```json
{
  "id": 1,
  "version_name": "Before Job Fair 2026",
  "data": { "...": "..." },
  "created_at": "2026-02-13T16:00:00"
}
```

**Errors:** `404` (version not found)

---

### `POST /api/documents/{document_id}/versions/{version_id}/restore`

Restore a document to a previous version.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `200 OK` — Updated document object with restored data.

---

### `DELETE /api/documents/{document_id}/versions/{version_id}`

Delete a saved version.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `204 No Content`

---

### `POST /api/documents/{document_id}/share`

Generate a shareable link for a document.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `200 OK`

```json
{
  "share_token": "<random-token>",
  "url": "/shared/<random-token>"
}
```

---

### `DELETE /api/documents/{document_id}/share`

Remove the shareable link from a document.

**Headers:** `Authorization: Bearer <access_token>`

**Response** `204 No Content`

---

### `GET /api/shared/{share_token}`

Public endpoint — view a shared document (no authentication required).

**Response** `200 OK`

```json
{
  "title": "My Professional Resume",
  "document_type": "resume",
  "data": { "...": "..." }
}
```

**Errors:** `404` (invalid share token)

## Static Files

| Path                                 | Description             |
| ------------------------------------ | ----------------------- |
| `/uploads/profile_images/{filename}` | Uploaded profile images |

---

## Error Responses

All errors follow this format:

```json
{
  "detail": "Error description"
}
```

| Status Code | Meaning                                                    |
| ----------- | ---------------------------------------------------------- |
| `400`       | Bad request (validation failure, duplicate email/username) |
| `401`       | Unauthorized (invalid/expired token)                       |
| `403`       | Forbidden (account locked, insufficient permissions)       |
| `404`       | Resource not found                                         |
| `413`       | Request body too large (> 10 MB)                           |
| `422`       | Validation error (Pydantic)                                |
| `429`       | Rate limit exceeded                                        |
| `500`       | Internal server error                                      |

---

## Rate Limiting

Requests are rate-limited per IP address:

| Scope                          | Limit       | Window     |
| ------------------------------ | ----------- | ---------- |
| General API                    | 60 requests | per minute |
| Login/register endpoints       | 10 requests | per minute |

Successful responses include:

```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 58
```

When exceeded:

```
HTTP/1.1 429 Too Many Requests
Retry-After: 45
```
