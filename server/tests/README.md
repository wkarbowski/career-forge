# Backend Tests

This directory contains the test suite for the Career Forge backend API.

## Running Tests

### Option 1: Using PostgreSQL (Recommended)

The tests work best with a PostgreSQL database since the application uses PostgreSQL-specific types (JSONB).

**Using Docker:**

```bash
# Start a test PostgreSQL instance
docker run --name career-forge-test-db \
  -e POSTGRES_PASSWORD=testpass \
  -e POSTGRES_USER=testuser \
  -e POSTGRES_DB=testdb \
  -p 5433:5432 \
  -d postgres:16-alpine

# Set test environment variables
export DATABASE_URL="postgresql://testuser:testpass@localhost:5433/testdb"
export SECRET_KEY="test-secret-key-minimum-32-characters-long"
export ENVIRONMENT="development"

# Run tests
cd server
pip install -r requirements-dev.txt
pytest

# Cleanup
docker stop career-forge-test-db
docker rm career-forge-test-db
```

## Test Structure

- `conftest.py` - Pytest fixtures and test configuration
- `test_auth.py` - Authentication endpoint tests (registration, login, token refresh)
- `test_documents.py` - Document CRUD operation tests

## Test Coverage

Run tests with coverage report:

```bash
pytest --cov=app --cov-report=html --cov-report=term-missing
```

View HTML coverage report:

```bash
open htmlcov/index.html  # macOS
xdg-open htmlcov/index.html  # Linux
start htmlcov/index.html  # Windows
```

## Writing New Tests

### Test Fixtures Available

- `db` - Fresh database session for each test
- `client` - FastAPI TestClient with database override
- `test_user` - Regular user account
- `other_user` - Second user account
- `auth_headers` - Authorization headers for test_user

### Example Test

```python
def test_my_endpoint(client: TestClient, auth_headers: dict) -> None:
    """Test description."""
    response = client.get("/api/my-endpoint", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["key"] == "expected_value"
```

## CI/CD Integration

Tests are automatically run on GitHub Actions for every pull request. See `.github/workflows/ci.yml` for the CI configuration.

## Troubleshooting

**ImportError or ModuleNotFoundError:**

- Ensure you're in the `server/` directory
- Install dev dependencies: `pip install -r requirements-dev.txt`

**Database connection errors:**

- Ensure PostgreSQL is running.
- Verify `DATABASE_URL` points to the PostgreSQL test database.

**JSONB compilation errors:**

- This indicates PostgreSQL-specific types are being used without a PostgreSQL test database.
- Start the PostgreSQL test database and verify `DATABASE_URL`.
