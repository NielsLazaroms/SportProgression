# syntax=docker/dockerfile:1

# ---- Build: compile TypeScript with all dependencies -----------------------
# Debian based (not Alpine): bcrypt ships prebuilt binaries for glibc only.
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Runtime: only the compiled app and production dependencies ------------
FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=3001 \
    TZ=UTC
WORKDIR /app
COPY --from=build --chown=node:node /app/package.json /app/package-lock.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# Pending database migrations are applied on startup (DB_MIGRATIONS_RUN).
CMD ["node", "dist/src/main.js"]
