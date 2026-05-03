# Contributing to Career Forge

Thank you for considering contributing! Please follow these guidelines to keep collaboration smooth.

## Getting Started

- Fork the repository and create a branch for your change: `git checkout -b feature/your-feature`
- Keep changes small and focused; open a pull request (PR) when ready
- Write clear PR titles and descriptions, and link any relevant issues

## Code Style & Tests

- Follow existing code style. TypeScript strict type-checking (`npm run lint`) is enforced for the frontend; PEP 8 for the Python backend
- Run `npm run build` (client) or `pytest` (server) to verify nothing is broken before opening a PR
- Add tests for bug fixes and new features when practical

## Commit Messages & Branches

- Use descriptive commit messages. One logical change per commit
- Branch naming: `feature/*`, `fix/*`, `chore/*`, `docs/*`

## Review Process

- PRs will be reviewed by maintainers. Address review comments promptly
- Squash commits if requested to keep the history clean

## Security and Sensitive Data

- Do not commit secrets, passwords, or private keys — use `.env` files and environment variables
- If you discover a security vulnerability, follow [SECURITY.md](SECURITY.md) to report it privately; do not open a public issue

---

Thank you for your contribution — it is genuinely appreciated!
