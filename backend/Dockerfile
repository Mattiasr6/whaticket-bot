# ============================================================
# Stage 1: Build — full image with dev toolchain
# ============================================================
FROM node:18-bullseye AS build

# Install system utilities (dumb-init for init, dockerize for MySQL wait)
ENV DOCKERIZE_VERSION v0.6.1
RUN apt-get update \
    && apt-get install -y --no-install-recommends wget dumb-init \
    && wget -q -O /tmp/dockerize.tar.gz \
       "https://github.com/jwilder/dockerize/releases/download/$DOCKERIZE_VERSION/dockerize-linux-amd64-$DOCKERIZE_VERSION.tar.gz" \
    && tar -C /usr/local/bin -xzf /tmp/dockerize.tar.gz \
    && rm /tmp/dockerize.tar.gz \
    && rm -rf /var/lib/apt/lists/*

# Skip Puppeteer/Chromium — not needed (Baileys/whaileys instead)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /usr/src/app

# Install ALL deps (including devDeps for build)
COPY package*.json ./
RUN npm ci --no-audit --no-fund

# Copy source and compile TypeScript
COPY . .
RUN npm run build

# Strip devDependencies — only production deps remain in node_modules
RUN npm prune --production && rm -rf ~/.npm

# ============================================================
# Stage 2: Production — minimal runtime image
# ============================================================
FROM node:18-bullseye-slim

# Copy runtime tools from build stage
COPY --from=build /usr/bin/dumb-init /usr/local/bin/
COPY --from=build /usr/local/bin/dockerize /usr/local/bin/

WORKDIR /usr/src/app

# Copy compiled JavaScript
COPY --from=build /usr/src/app/dist ./dist

# Copy production-only node_modules (already pruned)
COPY --from=build /usr/src/app/node_modules ./node_modules

# Copy package.json for metadata only (npm not invoked at runtime)
COPY --from=build /usr/src/app/package.json ./
COPY --from=build /usr/src/app/.sequelizerc ./

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD dockerize -wait tcp://${DB_HOST}:3306 \
  && npx sequelize db:migrate \
  && node dist/server.js
