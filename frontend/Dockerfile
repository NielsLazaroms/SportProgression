# syntax=docker/dockerfile:1

# ---- Build: Angular production bundle --------------------------------------
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# ---- Runtime: nginx serves the app and forwards /api to the backend --------
# The unprivileged image runs as a normal user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.27-alpine
# Where nginx forwards /api/ to. "backend" is the service name in both
# docker-compose.yml and the Kubernetes manifests.
ENV BACKEND_URL=http://backend:3001
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/SportProgression/browser /usr/share/nginx/html
EXPOSE 8080
