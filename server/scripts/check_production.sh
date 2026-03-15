#!/bin/bash
# =============================================================================
# Career Forge — Production Readiness Check
# =============================================================================
# Run from the server/ directory against your production .env file to verify
# that all required security settings are correctly configured.
#
# Usage:
#   cd server/
#   ./scripts/check_production.sh
# =============================================================================

set -eo pipefail

echo "=== Career Forge Production Readiness Check ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

check_pass() {
    echo -e "${GREEN}✓${NC} $1"
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

# Load .env file safely
if [ -f .env ]; then
    set -a
    # shellcheck source=.env
    source .env
    set +a
elif [ -f ../.env ]; then
    set -a
    source ../.env
    set +a
else
    check_fail ".env file not found (run from server/ directory)"
    exit 1
fi

echo "Checking security settings..."
echo ""

# Check DEBUG
if [ "$DEBUG" = "false" ]; then
    check_pass "DEBUG is disabled"
else
    check_fail "DEBUG must be 'false' in production"
fi

# Check ENVIRONMENT
if [ "$ENVIRONMENT" = "production" ]; then
    check_pass "ENVIRONMENT is set to production"
else
    check_warn "ENVIRONMENT is '$ENVIRONMENT' (should be 'production')"
fi

# Check SECRET_KEY length
if [ ${#SECRET_KEY} -ge 64 ]; then
    check_pass "SECRET_KEY is sufficiently long (${#SECRET_KEY} chars)"
else
    check_fail "SECRET_KEY is too short (${#SECRET_KEY} chars, need 64+)"
fi

# Check ENFORCE_HTTPS
if [ "$ENFORCE_HTTPS" = "true" ]; then
    check_pass "HTTPS enforcement is enabled"
else
    check_fail "ENFORCE_HTTPS must be 'true' in production"
fi

# Check COOKIE_SECURE
if [ "$COOKIE_SECURE" = "true" ]; then
    check_pass "Secure cookies are enabled"
else
    check_fail "COOKIE_SECURE must be 'true' in production"
fi

# Check COOKIE_SAMESITE
if [ "$COOKIE_SAMESITE" = "strict" ]; then
    check_pass "SameSite cookie policy is strict"
elif [ "$COOKIE_SAMESITE" = "lax" ]; then
    check_warn "SameSite cookie policy is 'lax' (consider 'strict')"
else
    check_fail "COOKIE_SAMESITE should be 'strict' or 'lax'"
fi

# Check CORS_ORIGINS for localhost
if echo "$CORS_ORIGINS" | grep -q "localhost"; then
    check_fail "CORS_ORIGINS contains localhost (remove for production)"
else
    check_pass "CORS_ORIGINS does not contain localhost"
fi

# Check DATABASE_URL
if echo "$DATABASE_URL" | grep -q "postgresql"; then
    check_pass "Using PostgreSQL database"
else
    check_fail "Not using PostgreSQL (SQLite not recommended for production)"
fi

# Check for default/weak passwords in DATABASE_URL
if echo "$DATABASE_URL" | grep -qE "(password|123456|careerforge_dev|cvapp_dev)"; then
    check_fail "DATABASE_URL may contain a weak/default password"
else
    check_pass "DATABASE_URL password appears secure"
fi

# Check RATE_LIMIT_BACKEND
if [ "$RATE_LIMIT_BACKEND" = "redis" ]; then
    check_pass "Using Redis for rate limiting"
else
    check_warn "Using memory-based rate limiting (Redis recommended for production)"
fi

# Check TRUSTED_HOSTS
if [ -n "$TRUSTED_HOSTS" ]; then
    check_pass "TRUSTED_HOSTS is configured"
else
    check_warn "TRUSTED_HOSTS is empty (consider setting for production)"
fi

# Check ACCOUNT_LOCKOUT_ATTEMPTS
if [ "${ACCOUNT_LOCKOUT_ATTEMPTS:-10}" -le 5 ]; then
    check_pass "Account lockout threshold is strict ($ACCOUNT_LOCKOUT_ATTEMPTS attempts)"
else
    check_warn "Account lockout allows ${ACCOUNT_LOCKOUT_ATTEMPTS:-10} attempts (consider 5 or fewer)"
fi

echo ""
echo "=== Summary ==="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}All checks passed! Ready for production.${NC}"
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}$WARNINGS warning(s) found. Review before deploying.${NC}"
else
    echo -e "${RED}$ERRORS error(s) and $WARNINGS warning(s) found.${NC}"
    echo -e "${RED}Fix all errors before deploying to production!${NC}"
    exit 1
fi

echo ""
echo "=== Additional Production Steps ==="
echo "1. Set up SSL/TLS certificates (Let's Encrypt recommended)"
echo "2. Configure a reverse proxy (Nginx/Caddy)"
echo "3. Set up Redis for distributed rate limiting"
echo "4. Configure regular database backups (see scripts/backup_database.sh)"
echo "5. Set up monitoring and alerting (Sentry, Prometheus, Grafana)"
echo "6. Use a process manager to supervise containers (Docker Compose, systemd)"

