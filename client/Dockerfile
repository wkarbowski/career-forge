# ============================================================
# React Frontend Dockerfile — multi-stage build, Nginx prod
# ============================================================

# --------------- Stage 1: Build ---------------
FROM node:20-alpine AS build

WORKDIR /app

# Copy dependency manifests first (layer caching)
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies
RUN if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    elif [ -f package-lock.json ]; then npm ci; \
    else npm install; fi

# Copy source files
COPY . .

# Build arguments — baked into the static bundle at build time
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
ARG VITE_GDPR=false
ENV VITE_GDPR=$VITE_GDPR

RUN npm run build

# --------------- Stage 2: Production (Nginx) ---------------
FROM nginx:1.27-alpine AS production

LABEL maintainer="careerforge" \
      description="React frontend for Career Forge served via Nginx"

# Remove default Nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Enable gzip compression in Nginx http block
RUN sed -i '/http {/a \    gzip on;\n    gzip_vary on;\n    gzip_proxied any;\n    gzip_comp_level 6;\n    gzip_min_length 256;\n    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;' /etc/nginx/nginx.conf

# Copy built static assets from build stage
COPY --from=build /app/build /usr/share/nginx/html

# Nginx runs on port 80
EXPOSE 80

# Healthcheck using /index.html
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD wget -qO- http://127.0.0.1:80/index.html || exit 1

CMD ["nginx", "-g", "daemon off;"]
