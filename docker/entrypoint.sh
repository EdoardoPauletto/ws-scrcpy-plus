#!/bin/sh
set -e

# Run the adb server inside the container, so it owns the USB devices passed in
# (see docker-compose.usb.yml) and the keys stored in /root/.android.
adb start-server

# Devices reachable over the network: ADB_CONNECT="192.168.1.10:5555,192.168.1.11"
# They are connected in the background and reconnected every
# ADB_RECONNECT_INTERVAL seconds (0 = connect once) whenever they are missing or
# offline: after a reboot of the host the network or the devices may not be up
# yet, and a device that drops off Wi-Fi comes back on its own. The server picks
# devices up as they appear.
adb_connect_targets() {
    for target in $(echo "${ADB_CONNECT:-}" | tr ',' ' '); do
        case "$target" in
            *:*) serial="$target" ;;
            *) serial="$target:5555" ;;
        esac
        state=$(adb devices | awk -v s="$serial" '$1 == s { print $2 }')
        case "$state" in
            # connected, or waiting for the user to accept the authorization prompt
            device | unauthorized | authorizing | connecting) ;;
            *)
                if [ "$state" = offline ]; then
                    adb disconnect "$serial" >/dev/null 2>&1 || true
                fi
                # failures are logged once, not on every retry
                out=$(adb connect "$serial" 2>&1) || true
                case "$out" in
                    *"connected to"*) echo "$out" ;;
                    *) [ -n "$quiet" ] || echo "$out (retrying in the background)" ;;
                esac
                ;;
        esac
    done
}

if [ -n "${ADB_CONNECT:-}" ]; then
    (
        interval="${ADB_RECONNECT_INTERVAL:-30}"
        quiet=
        while :; do
            adb_connect_targets
            [ "$interval" -gt 0 ] 2>/dev/null || break
            quiet=1
            sleep "$interval"
        done
    ) &
fi

exec "$@"
