# syntax=docker/dockerfile:1
#
# Multi-architecture: linux/amd64, linux/arm64, linux/arm/v7 (32-bit ARM).
# The bundles are plain JavaScript, so they are always built on the build host
# ($BUILDPLATFORM, natively even when cross-building); only the native addon
# (node-pty) and the runtime image are made for the target architecture:
#   podman build --platform linux/arm/v7 -t ws-scrcpy:local .
# The target stages name `--platform=$TARGETPLATFORM` explicitly: Podman 4.x
# otherwise builds every stage after a `$BUILDPLATFORM` one for the build host.

ARG NODE_VERSION=22
ARG TARGETPLATFORM

# ---- build: compile client + server bundles, then drop dev dependencies ----
FROM --platform=$BUILDPLATFORM docker.io/library/node:${NODE_VERSION}-bookworm AS build
WORKDIR /src

COPY package.json package-lock.json .npmrc ./
# Optional deps are Appium (iOS control only); not needed for Android.
# No install scripts: node-pty is compiled for the target in the `native` stage
RUN npm ci --omit=optional --ignore-scripts --no-audit --no-fund

COPY . .
# .npmrc forces `include=dev`, which would override `--omit=dev`
RUN npm run dist \
    && rm .npmrc \
    && npm prune --omit=dev --omit=optional --ignore-scripts --no-audit --no-fund

# ---- native: build node-pty (remote shell) for the target architecture ----
FROM --platform=$TARGETPLATFORM docker.io/library/node:${NODE_VERSION}-bookworm-slim AS native
WORKDIR /src

RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /src/node_modules ./node_modules
# Headers from the image itself: no download from nodejs.org
RUN npm_config_nodedir=/usr/local npm rebuild node-pty --no-audit --no-fund \
    && rm -rf node_modules/node-pty/build/Release/obj.target

# ---- runtime ----
FROM --platform=$TARGETPLATFORM docker.io/library/node:${NODE_VERSION}-bookworm-slim
ARG TARGETARCH
ARG PLATFORM_TOOLS_URL=https://dl.google.com/android/repository/platform-tools-latest-linux.zip

# Official platform-tools are x86_64 only; other architectures use Debian's adb
# from bookworm-backports (34.x: bookworm's 29.x has no `adb pair` / TLS)
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
        echo 'deb http://deb.debian.org/debian bookworm-backports main' \
            > /etc/apt/sources.list.d/backports.list; \
        apt-get update; \
        apt-get install -y --no-install-recommends -t bookworm-backports adb; \
    fi; \
    rm -rf /var/lib/apt/lists/*; \
    adb version

WORKDIR /app
# dist/index.js resolves its externals from /app/node_modules
COPY --from=native /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/ws-scrcpy-entrypoint

ENV NODE_ENV=production
EXPOSE 8000

ENTRYPOINT ["ws-scrcpy-entrypoint"]
CMD ["node", "dist/index.js"]
