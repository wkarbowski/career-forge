# Database Schema

> SQLAlchemy models, relationships, migrations, and entity-relationship diagram.

---

## Table of Contents

- [Entity-Relationship Diagram](#entity-relationship-diagram)
- [Models](#models)
- [Relationships](#relationships)
- [Migrations](#migrations)
- [Database Configuration](#database-configuration)

---

## Entity-Relationship Diagram

```
┌───────────────────────┐       ┌───────────────────────┐
│        users          │       │      documents        │
├───────────────────────┤       ├───────────────────────┤
│ id          PK  INT   │──┐    │ id          PK  INT   │
│ email       UQ  STR   │  │    │ title           STR   │
│ username    UQ  STR   │  ├───►│ document_type   STR   │
│ hashed_password  STR  │  │    │ data           JSONB  │
│ is_active      BOOL   │  │    │ owner_id    FK  INT   │
│ is_admin       BOOL   │  │    │ is_default     BOOL   │
│ theme          STR    │  │    │ profile_image   STR   │
│ language       STR    │  │    │ created_at      DT    │
│ created_at     DT     │  │    │ updated_at      DT    │
│ updated_at     DT     │  │    └───────────────────────┘
└───────────────────────┘  │    ┌───────────────────────┐
                           │    │   refresh_tokens      │
                           │    ├───────────────────────┤
                           │    │ id          PK  INT   │
                           ├───►│ token_hash  UQ  STR   │
                           │    │ user_id     FK  INT   │
                           │    │ device_info     STR   │
                           │    │ is_revoked     BOOL   │
                           │    │ used_at         DT    │
                           │    │ expires_at      DT    │
                           │    │ created_at      DT    │
                           │    └───────────────────────┘
                           │
                           │    ┌───────────────────────┐
                           │    │     audit_logs        │
                           └ ─ ─│ (no FK, user_id ref)  │
                                ├───────────────────────┤
                                │ id          PK  INT   │
                                │ timestamp       DT    │
                                │ event_type      STR   │
                                │ severity        STR   │
                                │ user_id         INT   │
                                │ user_email      STR   │
                                │ description     STR   │
                                │ details         TEXT  │
                                │ ip_address      STR   │
                                │ user_agent      STR   │
                                │ endpoint        STR   │
                                │ success         STR   │
                                └───────────────────────┘
```

---

## Models

### User

**Table:** `users`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | Integer | PK, indexed | auto-increment | Unique identifier |
| `email` | String(255) | Unique, indexed, NOT NULL | — | User's email (normalized) |
| `username` | String(100) | Unique, indexed, NOT NULL | — | Display name |
| `hashed_password` | String(255) | NOT NULL | — | bcrypt hash |
| `is_active` | Boolean | — | `True` | Account active flag |
| `is_admin` | Boolean | — | `False` | Admin privileges |
| `theme` | String(20) | — | `"dark"` | UI theme preference |
| `language` | String(10) | — | `"en"` | UI language preference |
| `created_at` | DateTime | — | `utcnow` | Account creation timestamp |
| `updated_at` | DateTime | — | `utcnow` (auto-update) | Last modification |

---

### Document

**Table:** `documents`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | Integer | PK, indexed | auto-increment | Unique identifier |
| `title` | String(255) | NOT NULL | `"My CV"` | Document title |
| `document_type` | String(20) | NOT NULL | `"resume"` | Type: `resume` or `cover_letter` |
| `data` | JSONB | NOT NULL | — | Full document content as PostgreSQL JSONB |
| `owner_id` | Integer | FK → `users.id`, NOT NULL | — | Owner reference |
| `is_default` | Boolean | — | `False` | Default document flag |
| `profile_image` | String(255) | Nullable | `None` | Profile image filename |
| `created_at` | DateTime | — | `utcnow` | Creation timestamp |
| `updated_at` | DateTime | — | `utcnow` (auto-update) | Last modification |

**Note:** The `data` field stores the entire document as a PostgreSQL JSONB column. This includes personal info, experience, education, skills, languages, etc., as well as settings (colors), visible sections, and sidebar order.

---

### RefreshToken

**Table:** `refresh_tokens`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | Integer | PK, indexed | auto-increment | Unique identifier |
| `token_hash` | String(255) | Unique, indexed | — | SHA-256 hash of token |
| `user_id` | Integer | FK → `users.id`, NOT NULL | — | Token owner |
| `device_info` | String(255) | Nullable | — | Browser/device identifier |
| `is_revoked` | Boolean | — | `False` | Revocation flag |
| `used_at` | DateTime | Nullable | `None` | When token was used (rotation) |
| `expires_at` | DateTime | NOT NULL | — | Expiration timestamp |
| `created_at` | DateTime | — | `utcnow` | Creation timestamp |

**Security notes:**
- Raw tokens are never stored; only SHA-256 hashes
- `used_at != NULL` indicates the token has been rotated
- If a token with `used_at != NULL` is presented, ALL user tokens are revoked (theft detection)

---

### AuditLog

**Table:** `audit_logs`

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | Integer | PK, indexed | auto-increment | Unique identifier |
| `timestamp` | DateTime | indexed | `utcnow` | Event time |
| `event_type` | String(50) | NOT NULL, indexed | — | Event category |
| `severity` | String(20) | — | `"info"` | INFO/WARNING/ALERT/CRITICAL |
| `user_id` | Integer | Nullable, indexed | — | Associated user |
| `user_email` | String(255) | Nullable | — | User email at time of event |
| `description` | String(500) | NOT NULL | — | Human-readable description |
| `details` | Text | Nullable | — | Additional JSON data |
| `ip_address` | String(45) | — | — | Client IP (IPv6 compatible) |
| `user_agent` | String(500) | Nullable | — | Browser/client info |
| `endpoint` | String(255) | Nullable | — | API endpoint path |
| `success` | String(10) | — | — | "true", "false", or null |

**Composite Indexes (for efficient querying):**
- `(user_id, timestamp)`
- `(event_type, timestamp)`
- `(severity, timestamp)`
- `(ip_address, timestamp)`

---

## Relationships

```
User (1) ──── (N) Document
  │                 "documents" relationship, cascade: all, delete-orphan
  │
User (1) ──── (N) RefreshToken
                    "refresh_tokens" relationship, cascade: all, delete-orphan
```

- **User → Document**: One-to-many. Deleting a user cascades to delete all their documents.
- **User → RefreshToken**: One-to-many. Deleting a user cascades to delete all their tokens.
- **AuditLog**: No foreign key to User. `user_id` is stored as a plain integer for historical preservation (logs persist even if the user is deleted).

---

## Migrations

Managed by **Alembic** (configured in `server/alembic.ini` and `server/alembic/env.py`).

### Migration History

| Revision | Description | Changes |
|----------|-------------|---------|
| `ac7b3eec10fe` | Baseline | Empty migration (snapshot of existing schema) |
| `6104f6581867` | Add profile image | Adds `profile_image` column (String 255, nullable) to `documents` table |

### Running Migrations

```bash
cd server

# Apply all pending migrations
alembic upgrade head

# Generate a new migration from model changes
alembic revision --autogenerate -m "description"

# Rollback one migration
alembic downgrade -1

# Show current revision
alembic current

# Show migration history
alembic history
```

### Configuration

The Alembic `env.py` overrides the database URL from `Settings.database_url`, so `alembic.ini` does not need to contain the connection string.

---

## Database Configuration

### PostgreSQL

The application requires PostgreSQL (uses JSONB columns).

```env
DATABASE_URL=postgresql://careerforge:password@localhost:5432/careerforge
```

**Connection Pooling:**
- Pool type: `QueuePool`
- Pool size: 5
- Max overflow: 10
- Pool pre-ping: `True` (connection health check)
- Pool recycle: 1800 seconds (30 minutes)

### Setup Scripts

| Script | Purpose |
|--------|---------|
| `scripts/setup_postgres.sh` | Create PostgreSQL database and user |
| `scripts/backup_database.sh` | Backup/restore PostgreSQL databases |

### Document Data JSON Structure

The `data` field in the `documents` table stores a JSONB value with this structure:

```json
{
  "name": "John Doe",
  "position": "Software Engineer",
  "phone": "+1 234 567 890",
  "email": "john@example.com",
  "linkedin": "linkedin.com/in/johndoe",
  "location": "New York, NY",
  "summary": "Experienced developer...",
  "strengths": [
    { "title": "Leadership", "description": "..." }
  ],
  "languages": [
    { "name": "English", "level": 5 },
    { "name": "German", "level": 3 }
  ],
  "skills": [
    { "name": "JavaScript" },
    { "name": "Python" }
  ],
  "achievements": [
    { "title": "Award", "description": "..." }
  ],
  "experience": [
    {
      "title": "Senior Developer",
      "company": "Acme Corp",
      "period": "2020 - Present",
      "location": "New York",
      "description": "Led team of 5..."
    }
  ],
  "education": [
    {
      "degree": "B.Sc. Computer Science",
      "school": "MIT",
      "period": "2012 - 2016",
      "location": "Cambridge, MA"
    }
  ],
  "courses": [
    { "title": "AWS Solutions Architect", "description": "..." }
  ],
  "settings": {
    "sidebarColor1": "#312e81",
    "sidebarColor2": "#4f46e5",
    "accentColor": "#6366f1"
  },
  "visibleSections": {
    "summary": true,
    "strengths": true,
    "languages": true,
    "skills": true,
    "achievements": true,
    "experience": true,
    "education": true,
    "courses": true
  },
  "sidebarOrder": [
    "summary", "skills", "languages", "courses", "strengths", "achievements"
  ]
}
```
