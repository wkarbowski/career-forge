# Career Forge — local development helpers
# Mirrors the GitHub Actions CI pipeline so failures are caught before push.
#
# Usage:
#   make ci          → full CI run (lint + test + build)
#   make lint        → backend ruff + frontend tsc
#   make fmt         → auto-format backend (ruff --fix + ruff-format)
#   make test        → run pytest (requires DATABASE_URL env var or .env.test)
#   make build       → production frontend build
#   make hooks       → install pre-commit hooks into .git/hooks

.PHONY: ci lint fmt test build hooks

# ── Colours ──────────────────────────────────────────────────────────────────
BOLD  := $(shell tput bold 2>/dev/null)
RESET := $(shell tput sgr0 2>/dev/null)
GREEN := $(shell tput setaf 2 2>/dev/null)
CYAN  := $(shell tput setaf 6 2>/dev/null)
RED   := $(shell tput setaf 1 2>/dev/null)

# ── Full CI (mirrors .github/workflows/ci.yml) ───────────────────────────────
ci: lint test build
	@echo "$(GREEN)$(BOLD)✓ All CI checks passed$(RESET)"

# ── Lint ─────────────────────────────────────────────────────────────────────
lint: lint-backend lint-frontend

lint-backend:
	@echo "$(CYAN)$(BOLD)→ Backend: ruff check$(RESET)"
	cd server && ruff check app/
	@echo "$(CYAN)$(BOLD)→ Backend: mypy (non-blocking)$(RESET)"
	-cd server && mypy app/ --config-file pyproject.toml

lint-frontend:
	@echo "$(CYAN)$(BOLD)→ Frontend: tsc --noEmit$(RESET)"
	cd client && npm run lint

# ── Format ───────────────────────────────────────────────────────────────────
fmt:
	@echo "$(CYAN)$(BOLD)→ Backend: ruff --fix + ruff-format$(RESET)"
	cd server && ruff check --fix app/ && ruff format app/

# ── Test ─────────────────────────────────────────────────────────────────────
# Requires a running PostgreSQL instance.
# Override DATABASE_URL to point at your local DB, e.g.:
#   make test DATABASE_URL=postgresql://careerforge:secret@localhost:5432/careerforge_dev
test:
ifndef DATABASE_URL
	$(error DATABASE_URL is not set. Export it or run: make test DATABASE_URL=postgresql://user:pass@localhost:5432/dbname)
endif
	@echo "$(CYAN)$(BOLD)→ Backend: pytest$(RESET)"
	cd server && \
	  SECRET_KEY=local-dev-secret-not-for-production \
	  DATABASE_URL=$(DATABASE_URL) \
	  ENVIRONMENT=test \
	  DEBUG=false \
	  CORS_ORIGINS=http://localhost:3000 \
	  pytest --tb=short -q

# ── Build ─────────────────────────────────────────────────────────────────────
build:
	@echo "$(CYAN)$(BOLD)→ Frontend: vite build$(RESET)"
	cd client && VITE_API_URL=/api npm run build

# ── Hooks ─────────────────────────────────────────────────────────────────────
hooks:
	@echo "$(CYAN)$(BOLD)→ Installing pre-commit hooks$(RESET)"
	# Install pre-commit into the repo venv (or globally if already active).
	pip install pre-commit --quiet 2>/dev/null || pip3 install pre-commit --user --quiet
	# Use .venv binary as fallback so the command works even without PATH update.
	$(shell command -v pre-commit 2>/dev/null || echo .venv/bin/pre-commit) install
	@echo "$(GREEN)✓ Hooks installed — they will run on every git commit$(RESET)"
