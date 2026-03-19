# Career Forge — API Server

FastAPI backend for the Career Forge resume and cover letter builder.

## Features

- User authentication (register, login, JWT tokens)
- CV CRUD operations (create, read, update, delete)
- Export/Import CVs as JSON
- CV duplication
- Default CV selection

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
DATABASE_URL="postgresql://careerforge:password@localhost:5432/careerforge"
SECRET_KEY="your-secret-key-change-in-production"
CORS_ORIGINS=["http://localhost:3000"]
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

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login (form-data) |
| POST | `/api/auth/login/json` | Login (JSON body) |
| GET | `/api/auth/me` | Get current user info |

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/documents/` | List all user's documents |
| POST | `/api/documents/` | Create a new document |
| GET | `/api/documents/{id}` | Get a specific document |
| PUT | `/api/documents/{id}` | Update a document |
| DELETE | `/api/documents/{id}` | Delete a document |
| GET | `/api/documents/{id}/export` | Export document as JSON |
| POST | `/api/documents/import` | Import document from JSON |
| POST | `/api/documents/{id}/duplicate` | Duplicate a document |
| GET | `/api/documents/default/current` | Get default/latest document |

## Example Usage

### Register a user

```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "username": "johndoe", "password": "secret123"}'
```

### Login

```bash
curl -X POST "http://localhost:8000/api/auth/login/json" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "secret123"}'
```

### Create a CV (with token)

```bash
curl -X POST "http://localhost:8000/api/documents/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My CV", "data": {"personal": {"name": "John Doe"}}}'
```

## Database

The application requires PostgreSQL (uses JSONB columns). Configure `DATABASE_URL` in your `.env` file or run `scripts/setup_postgres.sh` to create the database.

### Models

- **User**: id, email, username, hashed_password, is_active, is_admin, theme, language, created_at, updated_at
- **Document**: id, title, document_type, data (JSONB), owner_id, is_default, profile_image, created_at, updated_at

## Security Notes

- Change `SECRET_KEY` in production
- Use HTTPS in production
- Passwords are hashed using bcrypt
- JWT tokens expire after 7 days by default
