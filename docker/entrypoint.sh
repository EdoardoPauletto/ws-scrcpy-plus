#!/bin/sh
set -e

# Run the adb server inside the container, so it owns the USB devices passed in
# (see docker-compose.usb.yml) and the keys stored in /root/.android.
adb start-server

# Devices reachable over the network: ADB_CONNECT="192.168.1.10:5555,192.168.1.11"
for target in $(echo "${ADB_CONNECT:-}" | tr ',' ' '); do
    adb connect "$target" || true
done

exec "$@"
