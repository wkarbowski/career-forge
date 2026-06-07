# Career Forge — API Server

FastAPI backend for the Career Forge resume and cover letter builder.

## Features

- User authentication (register, login, JWT access tokens + HttpOnly refresh tokens)
- Document CRUD operations (create, read, update, delete)
- Export/Import documents as JSON
- Document duplication
- Default document selection
- Document version history (named snapshots)
- Shareable public links for documents
- Profile image upload
- Security audit logging

## Architecture

The server uses a layered FastAPI structure while keeping `app.main:app` as the
stable ASGI import target for Uvicorn, Gunicorn, Docker, and tests.

```
app/
├── main.py                 # Thin compatibility entrypoint
├── bootstrap.py            # create_app(), middleware, CORS, routers, static mounts
├── lifecycle.py            # Startup/shutdown lifecycle and token cleanup task
├── routes/                 # HTTP adapters only
│   ├── auth.py
│   ├── documents.py
│   └── public.py
├── services/               # Auth, account, document, version, share, image workflows
├── repositories/           # SQLAlchemy query/update helpers
├── security.py             # Compatibility facade for security exports
└── security_layers/        # Rate limiting, lockout, middleware, CSRF, sanitization
```

Route handlers validate HTTP inputs, manage cookies/files where needed, and
delegate business rules to services. Services coordinate repositories, token
helpers, audit logging, sanitization, and storage helpers. Repositories keep
database access explicit and close to SQLAlchemy models.

## Setup

### 1. Create virtual environment

```bash
cd server
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure environment (optional)

Create a `.env` file in the server directory:

```env
APP_NAME="Career Forge API"
DEBUG=true
# WARNING: replace <your-strong-password> with a real password — do not use verbatim
DATABASE_URL="postgresql://careerforge:<your-strong-password>@localhost:5432/careerforge"
SECRET_KEY="your-secret-key-change-in-production"
CORS_ORIGINS=http://localhost:3000
```

### 4. Run the server

```bash
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`

## API Documentation

- Swagger UI: `http://localhost:8000/api/docs`
- ReDoc: `http://localhost:8000/api/redoc`

## API Endpoints

### Authentication

| Method | Endpoint                    | Description             |
| ------ | --------------------------- | ----------------------- |
| POST   | `/api/auth/register`        | Register a new user     |
| POST   | `/api/auth/login`           | Login (form-data)       |
| POST   | `/api/auth/login/json`      | Login (JSON body)       |
| POST   | `/api/auth/refresh`         | Rotate refresh token    |
| POST   | `/api/auth/logout`          | Revoke current session  |
| POST   | `/api/auth/logout/all`      | Revoke all sessions     |
| GET    | `/api/auth/me`              | Get current user info   |
| PATCH  | `/api/auth/preferences`     | Update preferences      |
| POST   | `/api/auth/forgot-password` | Request password reset  |
| POST   | `/api/auth/reset-password`  | Complete password reset |
| POST   | `/api/auth/change-password` | Change password         |
| DELETE | `/api/auth/me`              | Delete account          |

### Documents

| Method | Endpoint                                              | Description                 |
| ------ | ----------------------------------------------------- | --------------------------- |
| GET    | `/api/documents/`                                     | List all user's documents   |
| POST   | `/api/documents/`                                     | Create a new document       |
| GET    | `/api/documents/{id}`                                 | Get a specific document     |
| PUT    | `/api/documents/{id}`                                 | Update a document           |
| DELETE | `/api/documents/{id}`                                 | Delete a document           |
| GET    | `/api/documents/{id}/export`                          | Export document as JSON     |
| POST   | `/api/documents/import`                               | Import document from JSON   |
| POST   | `/api/documents/{id}/duplicate`                       | Duplicate a document        |
| GET    | `/api/documents/default/current`                      | Get default/latest document |
| POST   | `/api/documents/{id}/versions`                        | Create a named version      |
| GET    | `/api/documents/{id}/versions`                        | List versions               |
| GET    | `/api/documents/{id}/versions/{version_id}`           | Get version detail          |
| POST   | `/api/documents/{id}/versions/{version_id}/restore`   | Restore version             |
| DELETE | `/api/documents/{id}/versions/{version_id}`           | Delete version              |
| POST   | `/api/documents/{id}/share`                           | Create share link           |
| DELETE | `/api/documents/{id}/share`                           | Revoke share link           |
| POST   | `/api/documents/{id}/upload-image`                    | Upload profile image        |
| DELETE | `/api/documents/{id}/profile-image`                   | Remove profile image        |

### Public

| Method | Endpoint                    | Description                     |
| ------ | --------------------------- | ------------------------------- |
| GET    | `/`                         | API service information         |
| GET    | `/api/health`               | Health check                    |
| GET    | `/api/shared/{share_token}` | Public read-only shared document |

## Example Usage

### Register a user

```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "username": "johndoe", "password": "SecureP@ss1"}'
```

### Login

```bash
curl -X POST "http://localhost:8000/api/auth/login/json" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "SecureP@ss1"}'
```

### Create a Resume (with token)

```bash
curl -X POST "http://localhost:8000/api/documents/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Untitled Resume", "data": {"personal": {"name": "John Doe"}}}'
```

## Database

The application requires PostgreSQL (uses JSONB columns). Configure `DATABASE_URL` in your `.env` file or run `scripts/setup_postgres.sh` to create the database.

### Models

- **User**: id, email, username, hashed_password, is_active, theme, language, created_at, updated_at
- **Document**: id, title, document_type, data (JSONB), owner_id, is_default, profile_image, share_token, linked_resume_id, created_at, updated_at
- **DocumentVersion**: id, document_id (FK), version_name, data (JSONB), created_at
- **RefreshToken**: id, token_hash, user_id, device_info, is_revoked, used_at, expires_at, created_at

## Security Notes

- Change `SECRET_KEY` in production
- Use HTTPS in production
- Passwords are hashed using bcrypt
- Passwords must be 8+ chars including uppercase, lowercase, digit, and special character
- Access tokens expire after 15 minutes; refresh tokens expire after 7 days
- Password reset emails are optional and use SMTP when configured
