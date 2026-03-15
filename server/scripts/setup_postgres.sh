#!/bin/bash
# =============================================================================
# Career Forge — PostgreSQL Setup Script
# =============================================================================
# Creates the application database and user for local development.
# Do NOT use the default password in production.
# =============================================================================

set -eo pipefail

# Configuration — override with environment variables if desired
DB_NAME="${POSTGRES_DB:-careerforge}"
DB_USER="${POSTGRES_USER:-careerforge}"
DB_PASSWORD="${POSTGRES_PASSWORD:-careerforge_dev_password}"  # Change this in production!

echo "=== Career Forge PostgreSQL Setup ==="
echo ""

# Check if PostgreSQL is running
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed or psql is not in PATH"
    echo ""
    echo "Install PostgreSQL:"
    echo "  Ubuntu/Debian: sudo apt install postgresql postgresql-contrib"
    echo "  Fedora/RHEL:   sudo dnf install postgresql-server postgresql-contrib"
    echo "  macOS:         brew install postgresql"
    exit 1
fi

echo "Creating database and user..."
echo ""

# Run as postgres user (may need sudo)
sudo -u postgres psql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${DB_USER}') THEN
        CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
EOF

echo ""
echo "✅ PostgreSQL setup complete!"
echo ""
echo "Connection string for .env:"
echo "DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the connection string above"
echo "2. Activate your virtual environment: source venv/bin/activate"
echo "3. Install dependencies: pip install -r requirements.txt"
echo "4. Start the server: uvicorn app.main:app --reload"
echo ""
echo "⚠️  Remember to change the password in production!"
