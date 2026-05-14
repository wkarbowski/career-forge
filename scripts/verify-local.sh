#!/usr/bin/env bash
# scripts/verify-local.sh
#
# Manually verify that everything works before pushing.
# Mirrors exactly what GitHub Actions CI runs.
#
# Usage:
#   ./scripts/verify-local.sh
#   ./scripts/verify-local.sh --skip-tests   # lint + build only (no DB needed)
#
# Requirements:
#   - DATABASE_URL exported, or passed as env var:
#       DATABASE_URL=postgresql://careerforge:devpassword@localhost:15432/careerforge_dev \
#         ./scripts/verify-local.sh
#   - pre-commit installed: pip install pre-commit
#   - npm dependencies installed: cd client && npm ci

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKIP_TESTS=false

for arg in "$@"; do
  [[ "$arg" == "--skip-tests" ]] && SKIP_TESTS=true
done

BOLD=$(tput bold 2>/dev/null || true)
GREEN=$(tput setaf 2 2>/dev/null || true)
RED=$(tput setaf 1 2>/dev/null || true)
CYAN=$(tput setaf 6 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)

pass() { echo "${GREEN}${BOLD}✓ $*${RESET}"; }
fail() { echo "${RED}${BOLD}✗ $*${RESET}"; exit 1; }
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
npm run lint || fail "TypeScript type-check failed"
pass "tsc passed"

# ── 4. Frontend tests (Vitest) ───────────────────────────────────────────────
if [[ "$SKIP_TESTS" == true ]]; then
  echo "${CYAN}Skipping tests (--skip-tests)${RESET}"
else
  step "Frontend tests (vitest)"
  cd "$REPO_ROOT/client"
  npm test || fail "Frontend tests failed"
  pass "Frontend tests passed"
fi

# ── 5. Backend tests (pytest) ─────────────────────────────────────────────────
if [[ "$SKIP_TESTS" == true ]]; then
  : # already skipped above
else
  step "Backend tests (pytest)"
  if [[ -z "${DATABASE_URL:-}" ]]; then
    fail "DATABASE_URL is not set. Export it or run with:\n  DATABASE_URL=postgresql://user:pass@localhost:5432/dbname ./scripts/verify-local.sh"
  fi
  cd "$REPO_ROOT/server"
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
VITE_API_URL=/api npm run build || fail "Frontend build failed"
pass "Build passed"

# ── Done ──────────────────────────────────────────────────────────────────────
echo
echo "${GREEN}${BOLD}All checks passed — safe to push.${RESET}"
