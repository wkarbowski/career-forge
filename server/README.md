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
APP_NAME="CV Builder API"
DEBUG=true
DATABASE_URL="sqlite:///./career_forge.db"
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

### CVs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/cvs/` | List all user's CVs |
| POST | `/api/cvs/` | Create a new CV |
| GET | `/api/cvs/{id}` | Get a specific CV |
| PUT | `/api/cvs/{id}` | Update a CV |
| DELETE | `/api/cvs/{id}` | Delete a CV |
| GET | `/api/cvs/{id}/export` | Export CV as JSON |
| POST | `/api/cvs/import` | Import CV from JSON |
| POST | `/api/cvs/{id}/duplicate` | Duplicate a CV |
| GET | `/api/cvs/default/current` | Get default/latest CV |

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
curl -X POST "http://localhost:8000/api/cvs/" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "My CV", "data": {"personal": {"name": "John Doe"}}}'
```

## Database

The application uses SQLite by default. The database file (`career_forge.db`) will be created automatically in the server directory when you first run the application.

### Models

- **User**: id, email, username, hashed_password, is_active, created_at, updated_at
- **CV**: id, title, data (JSON), owner_id, is_default, created_at, updated_at

## Security Notes

- Change `SECRET_KEY` in production
- Use HTTPS in production
- Passwords are hashed using bcrypt
- JWT tokens expire after 7 days by default
