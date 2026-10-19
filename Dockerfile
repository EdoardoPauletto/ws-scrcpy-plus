# syntax=docker/dockerfile:1

ARG NODE_VERSION=22

# ---- build: compile client + server bundles, then drop dev dependencies ----
FROM docker.io/library/node:${NODE_VERSION}-bookworm AS build
WORKDIR /src

# node-pty (remote shell) is a native addon built with node-gyp
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json .npmrc ./
COPY scripts ./scripts
# Optional deps are Appium (iOS control only); not needed for Android
RUN npm ci --omit=optional --no-audit --no-fund

COPY . .
# .npmrc forces `include=dev`, which would override `--omit=dev`
RUN npm run dist \
    && rm .npmrc \
    && npm prune --omit=dev --omit=optional --no-audit --no-fund

# ---- runtime ----
FROM docker.io/library/node:${NODE_VERSION}-bookworm-slim
ARG TARGETARCH
ARG PLATFORM_TOOLS_URL=https://dl.google.com/android/repository/platform-tools-latest-linux.zip

# Official platform-tools are x86_64 only; other architectures use Debian's adb
RUN set -eux; \
    apt-get update; \
    if [ -z "$TARGETARCH" ] || [ "$TARGETARCH" = "amd64" ]; then \
        apt-get install -y --no-install-recommends ca-certificates curl unzip; \
        curl -fsSL -o /tmp/platform-tools.zip "$PLATFORM_TOOLS_URL"; \
        unzip -q /tmp/platform-tools.zip -d /opt; \
        rm /tmp/platform-tools.zip; \
        ln -s /opt/platform-tools/adb /usr/local/bin/adb; \
        apt-get purge -y curl unzip; \
        apt-get autoremove -y; \
    else \
        apt-get install -y --no-install-recommends adb; \
    fi; \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
# dist/index.js resolves its externals from /app/node_modules
COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/ws-scrcpy-entrypoint

ENV NODE_ENV=production
EXPOSE 8000

ENTRYPOINT ["ws-scrcpy-entrypoint"]
CMD ["node", "dist/index.js"]
