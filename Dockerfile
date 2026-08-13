# ── Stage 1: install production dependencies ──────────────────────────────────
FROM node:18-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: final runtime image ──────────────────────────────────────────────
FROM node:18-alpine AS runner
WORKDIR /app

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy only what is needed
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js    ./
COPY routes/      ./routes/
COPY src/         ./src/
COPY public/      ./public/

# Ensure the app user owns the files
RUN chown -R appuser:appgroup /app
USER appuser

# Watsonx credentials are injected at runtime via environment variables —
# do NOT bake config.env into the image.
ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
