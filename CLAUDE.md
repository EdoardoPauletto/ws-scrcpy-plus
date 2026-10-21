# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ws-scrcpy-plus (https://github.com/EdoardoPauletto/ws-scrcpy-plus, fork of https://github.com/NetrisTV/ws-scrcpy) is a web client for scrcpy: a Node.js server (TypeScript) plus a browser app (TypeScript) that stream and control Android devices (via a modified `scrcpy-server.jar` with a built-in WebSocket server) and, experimentally, iOS devices (via `ws-qvh` for video and Appium/WebDriverAgent for control).

## Commands

```shell
npm install          # postinstall runs scripts/setup-appium.js (pins XCUITest driver into .appium-home; best-effort, never fails)
npm run dist:dev     # webpack dev build (inline source maps) -> dist/
npm run dist         # production build -> dist/
npm start            # prod build, then `cd dist && npm start` (node ./index.js)
npm run lint         # eslint src/ --ext .ts
npm run format       # eslint --fix (prettier is enforced via eslint)
npm run clean        # remove dist/
```

Containers (Android only): this project is developed and run with **podman**, not Docker: `podman-compose up -d --build` (not `podman compose`: on this machine it delegates to docker-compose v1, which needs the missing `docker` binary); add `-f docker-compose.usb.yml` for USB passthrough. Dependencies are not installed on the host (no `node_modules`), so the way to build/verify is the container build, not `npm run dist` locally. The `Dockerfile` is multi-arch (amd64, arm64, arm/v7): it builds the bundles on `$BUILDPLATFORM` with `--ignore-scripts`, prunes dev deps (removing `.npmrc`, whose `include=dev` would override `--omit=dev`), rebuilds `node-pty` for the target in a `native` stage, and runs `dist/` with `adb` (official platform-tools on amd64, bookworm-backports elsewhere) in a slim image; cross-build with `podman build --platform linux/arm/v7` (needs `qemu-user-static` on the host); `docker/entrypoint.sh` starts the adb server and `adb connect`s `ADB_CONNECT` targets.

There is no test suite (`npm test` is a stub). Verify changes by building and running the app; type errors surface during the webpack build (ts-loader).

Debugging the server: `npm run dist:dev && cd dist && node --inspect-brk ./index.js` (optionally `DEBUG=*`). See `docs/debug.md`, including how to debug `scrcpy-server.jar` on a device.

Runtime env vars: `WS_SCRCPY_CONFIG` (path to YAML/JSON config, schema in `src/types/Configuration.d.ts`, example in `config.example.yaml`), `WS_SCRCPY_PATHNAME`, `WS_SCRCPY_DEBUG`, and the iOS `WDA_*` / `APPIUM_*` vars documented in README.md.

Style: prettier with 4-space indent, single quotes, trailing commas, 120-char lines. Commit messages use conventional prefixes (`feat:`, `fix:`, `chore(deps):`).

## Build-time feature flags (important)

The build is two webpack configs from `webpack/ws-scrcpy.common.ts`: **frontend** (`src/app/index.ts` → `dist/public/bundle.js`) and **backend** (`src/server/index.ts` → `dist/index.js`, with a generated `dist/package.json`). Node deps are externals, so `dist/` runs against the repo's `node_modules`.

All `.ts` files go through `ifdef-loader` using flags from `webpack/default.build.config.json` merged with `build.config.override.json`. Code is gated with comment directives:

```ts
/// #if INCLUDE_GOOG
...
/// #endif
```

Flags: `INCLUDE_GOOG`, `INCLUDE_APPL` (iOS, **off by default**), `INCLUDE_ADB_SHELL`, `INCLUDE_DEV_TOOLS`, `INCLUDE_FILE_LISTING`, `USE_BROADWAY`, `USE_H264_CONVERTER`, `USE_TINY_H264`, `USE_WEBCODECS`, `USE_WDA_MJPEG_SERVER` (currently suspended), `USE_QVH_SERVER`, `SCRCPY_LISTENS_ON_ALL_INTERFACES`, plus `PATHNAME` (injected as `__PATHNAME__`). Code inside a disabled block is stripped before type-checking, so to compile/verify iOS code you must enable `INCLUDE_APPL` in `build.config.override.json`. Feature modules are loaded via dynamic `import()` inside these blocks in both entry points.

## Architecture

Naming: **goog** = Android, **appl** = iOS. Code is split into `src/server` (Node), `src/app` (browser), and `src/common` + `src/types` + `src/packages` (shared by both).

### Server: services + middleware (Mw)

`src/server/index.ts` starts singleton `Service`s (`HttpServer`, `WebSocketServer`, per-platform `ControlCenter`, `AppiumRunner` for iOS) and registers middleware factories in two lists:

- **`mwList`** – handle a raw WebSocket connection, dispatched by `?action=` query param (see `ACTION` in `src/common/Action.ts`). E.g. `WebsocketProxyOverAdb` (`proxy-adb`), `RemoteDevtools`, `WebsocketMultiplexer` (`multiplex`).
- **`mw2List`** – handle a *channel* inside a multiplexed WebSocket, dispatched by a 4-char channel code (`ChannelCode` in `src/common/ChannelCode.ts`: `GTRC`, `ATRC`, `SHEL`, `FSLS`, `HSTS`, `WDAP`, `QVHS`). E.g. `DeviceTracker`, `RemoteShell`, `FileListing`, `HostTracker`, `WebDriverAgentProxy`, `QVHStreamProxy`.

Each Mw class (`src/server/mw/Mw.ts`) implements static `processRequest(ws, params)` and/or `processChannel(multiplexer, code, data)`, returning an instance only if it claims the request. Adding a new server feature = new Mw subclass + an `ACTION` or `ChannelCode` + registration in `src/server/index.ts` (inside the appropriate `#if` block).

`src/packages/multiplexer/Multiplexer.ts` implements a WebSocket-compatible multiplexing protocol used on both sides; a new channel's first message starts with the 4-byte channel code.

### Android streaming path

`ControlCenter` (goog) tracks devices via adbkit (`@dead50f7/adbkit`, extended in `src/server/goog-device/adb/`). `ScrcpyServer` pushes the vendored `vendor/Genymobile/scrcpy/scrcpy-server.jar` to `/data/local/tmp/ws-scrcpy-server.jar` and runs it with `app_process`; its args and protocol version (`SERVER_VERSION`, port 8886) live in `src/common/Constants.ts` and must match the jar's `versionName`. The browser connects to the on-device WebSocket either directly or tunneled through the node server (`proxy-adb` → `WebsocketProxyOverAdb`). Video is H.264; input is sent back as binary control messages (`src/app/controlMessage/`).

The jar is official scrcpy v5.0.1 + `scrcpy-server/patches/*.patch` (rebuild with `scrcpy-server/build.sh`, runs in podman/docker). The patch adds the `com.genymobile.scrcpy.ws` package (`WsServer`, `WsStream`, …): one `WsStream` per display, reusing upstream `ScreenCapture`/`NewDisplayCapture` + `SurfaceEncoder` + `Controller`, shared by all clients of that display. Control messages use the upstream 5.x binary formats (each WebSocket message = one message), except ws-scrcpy's own types 101 (change stream settings, `VideoSettings` layout shared by `src/app/VideoSettings.ts` and `WsVideoSettings.java`) and 102 (file push). Device→browser messages are prefixed with `scrcpy_message`; the per-client `scrcpy_initial` message lists displays/streams/encoders and ends with the client id and the joined display id. `displayId = -1` requests a new virtual display, whose real id the client learns from that trailer. The settings end with a flags byte (keep active, flex display), then an optional `startApp` string: the package started (upstream `START_APP` control message) once a new virtual display exists, also reported back in the stream settings so clients can find the display running an app; a flex display is resized with control message 21 (`RESIZE_DISPLAY`). Audio is enabled per client with type 103 and arrives as raw PCM messages prefixed with `scrcpy_audio__` (one shared capture, `WsAudio`; played by `src/app/player/PcmAudioPlayer.ts`). Streams use `min_size_alignment=16` because Broadway ignores H.264 frame cropping. A client must not re-trigger encoder resets for unchanged settings: `StreamClientScrcpy` repeats its settings request until it gets the screen info. To modify the server: clone scrcpy at `v5.0.1`, `git am` the patch, change, then regenerate the patch with `git format-patch`.

Shareable app links: `src/server/goog-device/AppLinks.ts` serves `GET <pathname><device>/<package>` (index.html with a `<base href>`), `api/goog/devices/<device>` (resolve by serial or model slug, starts the server) and `api/goog/devices/<device>/apps` (runs the jar with `list_apps=true cleanup=false`). In the browser, `AppStreamLauncher` joins the virtual display whose settings have that `startApp`, or creates one; `ConfigureScrcpy` passes its settings to the new window through localStorage (`AppLinkClient`).

### Browser app

`src/app/index.ts` routes on the URL hash (`#!action=...&udid=...`): either starts a single tool/stream client or shows the device list (`HostTracker` → per-platform `DeviceTracker`). Tools (`ShellClient`, `DevtoolsClient`, `FileListingClient`, stream clients) register with a `DeviceTracker` and extend `ManagerClient`/`BaseClient`; `ManagerClient` shares one multiplexed WebSocket per URL across tools.

Stream clients (`StreamClientScrcpy`, `StreamClientQVHack`, `StreamClientMJPEG`) pick from registered decoders in `src/app/player/` (`MsePlayer`, `BroadwayPlayer`, `TinyH264Player`, `WebCodecsPlayer`, `MjpegPlayer`), all extending `BasePlayer`. Touch/mouse/keyboard handling is in `src/app/interactionHandler/` and `src/app/googDevice/KeyInputHandler.ts`.

### iOS (experimental)

Video: `ws-qvh` binary on PATH, proxied by `QVHStreamProxy` / `QvhackRunner`. Control: `AppiumRunner` spawns a bundled Appium server as a child process (driver home `.appium-home`, version pinned in `package.json` `config.xcuitestDriverVersion`); `WDARunner` creates per-device WebDriverAgent sessions and `WebDriverAgentProxy` forwards client commands over the `WDAP` channel.

## Vendored / third-party code

`vendor/` (Broadway decoder, h264-live-player, scrcpy-server.jar) and `typings/` (hand-written .d.ts for untyped deps) are excluded from linting; avoid reformatting them.
