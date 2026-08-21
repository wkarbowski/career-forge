# ── Dev Container image ───────────────────────────────────────────────────────
# Based on the official VS Code Python image (Python 3.12, Debian Bookworm).
# Adds Node 20, make, and postgresql-client so every tool needed by the project
# is available inside the container without any host-side installs.
FROM mcr.microsoft.com/devcontainers/python:3.12-bookworm

ARG NODE_VERSION=20

# Install Node via nvm (nvm is pre-installed in this base image, owned by vscode)
RUN su vscode -c "source /usr/local/share/nvm/nvm.sh \
    && nvm install ${NODE_VERSION} \
    && nvm alias default ${NODE_VERSION}" 2>&1

# System packages: make (for Makefile targets), postgresql-client (for psql)
RUN apt-get update \
    && apt-get install -y --no-install-recommends make postgresql-client \
    && rm -rf /var/lib/apt/lists/*
