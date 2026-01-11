# Build Stage for Frontend
FROM node:18-alpine AS build-stage
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
RUN npm run build

# Final Stage - Optimized for VPS
FROM node:18-bullseye-slim
WORKDIR /app

# Install minimal dependencies for Puppeteer/Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    ca-certificates \
    dumb-init \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Set environment variables for Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    NODE_ENV=production

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Install gosu for easy step-down from root
RUN apt-get update && apt-get install -y --no-install-recommends \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# Backend dependencies - use npm ci for faster, reproducible builds
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy backend source
COPY src ./src

# Copy built frontend from build-stage
COPY --from=build-stage /app/client/dist ./public

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Create directories with proper permissions
RUN mkdir -p uploads db .wwebjs_auth \
    && chown -R appuser:appuser /app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/status', (r) => process.exit(r.statusCode === 200 || r.statusCode === 401 ? 0 : 1))"

EXPOSE 3000
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "src/server.js"]
