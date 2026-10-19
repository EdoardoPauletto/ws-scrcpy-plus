#!/bin/sh
# Rebuild ../vendor/Genymobile/scrcpy/scrcpy-server.jar from the official scrcpy
# sources ($SCRCPY_VERSION) with the ws-scrcpy patches (patches/*.patch) applied.
# Everything runs in a container (podman or docker): no JDK/Android SDK needed.
set -e

SCRCPY_VERSION=v5.0.1

cd "$(dirname "$0")"
ENGINE=${CONTAINER_ENGINE:-$(command -v podman || command -v docker)}
if [ -z "$ENGINE" ]; then
    echo "podman or docker is required" >&2
    exit 1
fi

"$ENGINE" build -t ws-scrcpy-server-builder -f Containerfile .
"$ENGINE" run --rm \
    -v "$PWD:/work:Z" \
    -v ws-scrcpy-gradle:/root/.gradle \
    -e SCRCPY_VERSION="$SCRCPY_VERSION" \
    ws-scrcpy-server-builder sh -ec '
        git clone -q --depth 1 --branch "$SCRCPY_VERSION" https://github.com/Genymobile/scrcpy.git /src/scrcpy
        cd /src/scrcpy
        git -c user.name=build -c user.email=build@localhost am -q /work/patches/*.patch
        ./gradlew --no-daemon -q assembleRelease -p server
        cp server/build/outputs/apk/release/server-release-unsigned.apk /work/scrcpy-server.jar
    '
mv scrcpy-server.jar ../vendor/Genymobile/scrcpy/scrcpy-server.jar
echo "Updated vendor/Genymobile/scrcpy/scrcpy-server.jar"
