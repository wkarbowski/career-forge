#!/usr/bin/env bash
# scripts/verify-local.sh
#
# Manually verify that everything works before pushing.
# Mirrors exactly what GitHub Actions CI runs.
#
# Usage:
#   ./scripts/verify-local.sh
#   ./scripts/verify-local.sh --skip-tests           # lint + build only (no DB needed)
#   ./scripts/verify-local.sh --skip-backend-tests   # skip pytest only (DB not needed)
#
# Requirements:
#   - DATABASE_URL exported (for pytest), or pass --skip-backend-tests
#       DATABASE_URL=postgresql://careerforge:devpassword@localhost:15432/careerforge_dev \
#         ./scripts/verify-local.sh
#   - pre-commit installed: pip install pre-commit
#   - pnpm dependencies installed: cd client && pnpm install --frozen-lockfile

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_TESTS=false
SKIP_BACKEND_TESTS=false

for arg in "$@"; do
  [[ "$arg" == "--skip-tests" ]] && SKIP_TESTS=true
  [[ "$arg" == "--skip-backend-tests" ]] && SKIP_BACKEND_TESTS=true
done

BOLD=$(tput bold 2>/dev/null || true)
GREEN=$(tput setaf 2 2>/dev/null || true)
RED=$(tput setaf 1 2>/dev/null || true)
CYAN=$(tput setaf 6 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)

pass() { echo "${GREEN}${BOLD}✓ $*${RESET}"; }
fail() { printf "${RED}${BOLD}✗ %b${RESET}\n" "$*"; exit 1; }
step() { echo; echo "${CYAN}${BOLD}── $* ──${RESET}"; }

# ── 1. Pre-commit hooks (lint + type-check) ───────────────────────────────────
step "Pre-commit hooks (ruff, mypy, tsc)"
cd "$REPO_ROOT"
# Resolve pre-commit: prefer PATH, fall back to the repo venv.
if command -v pre-commit &>/dev/null; then
  PRE_COMMIT=pre-commit
elif [[ -x "$REPO_ROOT/.venv/bin/pre-commit" ]]; then
  PRE_COMMIT="$REPO_ROOT/.venv/bin/pre-commit"
else
  fail "pre-commit not found. Install it with: pip install pre-commit  OR  pip install -r server/requirements-dev.txt"
fi
"$PRE_COMMIT" run --all-files || fail "Pre-commit hooks failed"
pass "Hooks passed"

# ── 2. Backend lint ───────────────────────────────────────────────────────────
step "Backend lint (ruff)"
cd "$REPO_ROOT/server"
ruff check app/ || fail "ruff check failed"
pass "ruff passed"

# ── 3. Frontend type-check ────────────────────────────────────────────────────
step "Frontend type-check (tsc --noEmit)"
cd "$REPO_ROOT/client"
pnpm run lint || fail "TypeScript type-check failed"
pass "tsc passed"

# ── 4. Frontend tests (Vitest) ───────────────────────────────────────────────
if [[ "$SKIP_TESTS" == true ]]; then
  echo "${CYAN}Skipping tests (--skip-tests)${RESET}"
else
  step "Frontend tests (vitest)"
  cd "$REPO_ROOT/client"
  pnpm test || fail "Frontend tests failed"
  pass "Frontend tests passed"
fi

# ── 5. Backend tests (pytest) ─────────────────────────────────────────────────
if [[ "$SKIP_TESTS" == true || "$SKIP_BACKEND_TESTS" == true ]]; then
  echo "${CYAN}Skipping backend tests${RESET}"
else
  step "Backend tests (pytest)"
  # Auto-construct DATABASE_URL from .env POSTGRES_* vars when not already set.
  # The docker-compose.override.yml exposes Postgres on localhost:15432.
  if [[ -z "${DATABASE_URL:-}" && -f "$REPO_ROOT/.env" ]]; then
    # shellcheck disable=SC1091
    source <(grep -E '^(POSTGRES_USER|POSTGRES_PASSWORD|POSTGRES_DB)=' "$REPO_ROOT/.env" | sed 's/^/export /')
    POSTGRES_PORT_LOCAL="${POSTGRES_PORT:-15432}"
    if [[ -n "${POSTGRES_USER:-}" && -n "${POSTGRES_PASSWORD:-}" && -n "${POSTGRES_DB:-}" ]]; then
      DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT_LOCAL}/${POSTGRES_DB}"
      echo "${CYAN}Using DATABASE_URL from .env (port ${POSTGRES_PORT_LOCAL})${RESET}"
    fi
  fi
  if [[ -z "${DATABASE_URL:-}" ]]; then
    fail "DATABASE_URL is not set and could not be inferred from .env.\n\nOptions:\n  1. Start the dev stack:  docker compose up -d\n     (then re-run this script — it reads POSTGRES_* from .env automatically)\n  2. Pass it explicitly:\n     DATABASE_URL=postgresql://user:pass@localhost:15432/dbname ./scripts/verify-local.sh\n  3. Skip backend tests:\n     ./scripts/verify-local.sh --skip-backend-tests"
  fi
  cd "$REPO_ROOT/server"
  # Verify the DB is actually reachable before handing off to pytest.
  # Extracts host/port from the URL so we can do a fast TCP probe.
  _db_host=$(python3 -c "from urllib.parse import urlparse; u=urlparse('$DATABASE_URL'); print(u.hostname)" 2>/dev/null || true)
  _db_port=$(python3 -c "from urllib.parse import urlparse; u=urlparse('$DATABASE_URL'); print(u.port or 5432)" 2>/dev/null || true)
  if [[ -n "$_db_host" && -n "$_db_port" ]]; then
    if ! bash -c ">/dev/tcp/$_db_host/$_db_port" 2>/dev/null; then
      fail "Cannot reach PostgreSQL at $_db_host:$_db_port — is the dev stack running?\n  docker compose up -d"
    fi
  fi
  SECRET_KEY=local-dev-secret-not-for-production \
  DATABASE_URL="$DATABASE_URL" \
  ENVIRONMENT=test \
  DEBUG=false \
  CORS_ORIGINS=http://localhost:3000 \
  pytest --tb=short -q || fail "Tests failed"
  pass "Tests passed"
fi

# ── 6. Frontend production build ──────────────────────────────────────────────
step "Frontend build (vite)"
cd "$REPO_ROOT/client"
VITE_API_URL=/api pnpm run build || fail "Frontend build failed"
pass "Build passed"

# ── Done ──────────────────────────────────────────────────────────────────────
echo
echo "${GREEN}${BOLD}All checks passed — safe to push.${RESET}"
