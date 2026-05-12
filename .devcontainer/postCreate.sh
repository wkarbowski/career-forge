#!/usr/bin/env bash
# .devcontainer/postCreate.sh
# Runs once after the container is created (postCreateCommand in devcontainer.json).
# Sets up Python deps, Node deps, DB schema, and git hooks.

set -euo pipefail

WORKSPACE=/workspace
BOLD=$(tput bold 2>/dev/null || true)
GREEN=$(tput setaf 2 2>/dev/null || true)
CYAN=$(tput setaf 6 2>/dev/null || true)
RESET=$(tput sgr0 2>/dev/null || true)

step() { echo "${CYAN}${BOLD}→ $*${RESET}"; }
ok()   { echo "${GREEN}${BOLD}✓ $*${RESET}"; }

# ── Python dependencies ───────────────────────────────────────────────────────
step "Installing Python server dependencies (requirements-dev.txt)"
pip install --quiet -r "${WORKSPACE}/server/requirements-dev.txt"

# ── Database migrations ───────────────────────────────────────────────────────
step "Running Alembic migrations"
(cd "${WORKSPACE}/server" && alembic upgrade head)

# ── Node dependencies ─────────────────────────────────────────────────────────
step "Installing Node client dependencies (npm ci)"
(cd "${WORKSPACE}/client" && npm ci --prefer-offline)

# ── Pre-commit hooks ──────────────────────────────────────────────────────────
step "Installing pre-commit git hooks"
(cd "${WORKSPACE}" && pre-commit install)

ok "Dev environment ready!"
echo ""
echo "  Run servers:"
echo "    Backend  → cd server && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
echo "    Frontend → cd client && npm start"
echo ""
echo "  Or use the Makefile from the repo root:"
echo "    make lint    make test    make build    make ci"
