import '../../../style/material.css';
import '../../../style/applink.css';
import { ACTION } from '../../../common/Action';
import { SERVER_PORT } from '../../../common/Constants';
import { PACKAGE_NAME_RE } from '../../../common/AppLink';
import { ParamsStreamScrcpy } from '../../../types/ParamsStreamScrcpy';
import { DisplayCombinedInfo } from '../../client/StreamReceiver';
import { StreamReceiverScrcpy } from './StreamReceiverScrcpy';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import { AppLinkClient, AppLinkHandoff } from './AppLinkClient';
import VideoSettings from '../../VideoSettings';
import Util from '../../Util';
import SvgImage from '../../ui/SvgImage';
import { html } from '../../ui/HtmlTag';

const TAG = '[AppStreamLauncher]';
// Without a previous choice, the most efficient player available in this browser
const PREFERRED_PLAYERS = ['WebCodecs', 'H264 Converter', 'Broadway.js', 'Tiny H264'];
const TOOLBOX_WIDTH = 48;

/**
 * Opens a shareable stream link (<pathname><device>/<package>): joins the virtual display already showing the app, or
 * creates one and starts the app on it.
 */
export class AppStreamLauncher {
    private readonly status: HTMLElement;
    private streamReceiver?: StreamReceiverScrcpy;

    // The link of the current page, if any: [device, package]
    public static parseLocation(): [string, string] | undefined {
        const base = AppLinkClient.getBasePath();
        if (!location.pathname.startsWith(base)) {
            return;
        }
        const parts = location.pathname.slice(base.length).split('/').filter((part) => !!part);
        if (parts.length !== 2 || !PACKAGE_NAME_RE.test(parts[1])) {
            return;
        }
        return [decodeURIComponent(parts[0]), parts[1]];
    }

    public static start(device: string, packageName: string): AppStreamLauncher {
        return new AppStreamLauncher(device, packageName);
    }

    private constructor(private readonly device: string, private readonly packageName: string) {
        document.title = `${packageName} · ${device}`;
        document.body.classList.add('app-link');
        this.status = html`<div class="app-link-status">
            <div class="app-link-icon"></div>
            <div class="app-link-title">${packageName}</div>
            <div class="app-link-text">Connecting to ${device}…</div>
        </div>`.content.firstElementChild as HTMLElement;
        this.status.querySelector('.app-link-icon')?.appendChild(SvgImage.create(SvgImage.Icon.SMARTPHONE));
        document.body.appendChild(this.status);
        this.run().catch((error: Error) => {
            console.error(TAG, error);
            this.showError(error.message);
        });
    }

    private setStatus(text: string): void {
        const element = this.status.querySelector('.app-link-text') as HTMLElement;
        element.innerText = text;
    }

    private showError(message: string): void {
        this.streamReceiver?.stop();
        this.status.classList.add('error');
        this.setStatus(message);
        const home = document.createElement('a');
        home.className = 'md-button md-button-filled';
        home.href = AppLinkClient.getBasePath();
        home.appendChild(SvgImage.create(SvgImage.Icon.ARROW_BACK));
        home.appendChild(document.createTextNode('Device list'));
        this.status.appendChild(home);
    }

    private async run(): Promise<void> {
        const serverUrl = new URL(AppLinkClient.getBasePath(), location.href);
        const resolved = await AppLinkClient.resolveDevice(serverUrl, this.device);
        const { udid } = resolved;
        document.title = `${this.packageName} · ${resolved.model}`;
        this.setStatus(`Starting ${this.packageName} on ${resolved.model}…`);

        const handoff = AppLinkClient.takeHandoff(location.href);
        const playerName = this.choosePlayer(udid, handoff);
        if (!playerName) {
            throw new Error('No video player is supported by this browser');
        }
        const ws = new URL(serverUrl.toString());
        ws.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
        ws.searchParams.set('action', ACTION.PROXY_ADB);
        ws.searchParams.set('remote', `tcp:${SERVER_PORT}`);
        ws.searchParams.set('udid', udid);
        const params: ParamsStreamScrcpy = {
            action: ACTION.STREAM_SCRCPY,
            udid,
            player: playerName,
            ws: ws.toString(),
            hostname: location.hostname,
            port: location.port ? parseInt(location.port, 10) : location.protocol === 'https:' ? 443 : 80,
            secure: location.protocol === 'https:',
            pathname: serverUrl.pathname,
            audio: !!handoff?.audio,
            audioDup: !!handoff?.audioDup,
        };
        const streamReceiver = (this.streamReceiver = new StreamReceiverScrcpy(params));
        streamReceiver.once('displayInfo', (infoArray: DisplayCombinedInfo[]) => {
            this.openStream(params, streamReceiver, infoArray, handoff);
        });
        streamReceiver.on('disconnected', this.onDisconnected);
    }

    private onDisconnected = (): void => {
        this.showError('Connection to the device lost');
    };

    private choosePlayer(udid: string, handoff?: AppLinkHandoff): string | undefined {
        const available = StreamClientScrcpy.getPlayers().map((player) => player.playerFullName);
        let previous = '';
        try {
            previous = localStorage.getItem(`configure_stream::${Util.escapeUdid(udid)}::player`) || '';
        } catch (error) {
            // ignore
        }
        return [handoff?.player, previous, ...PREFERRED_PLAYERS].find((name) => !!name && available.includes(name));
    }

    private openStream(
        params: ParamsStreamScrcpy,
        streamReceiver: StreamReceiverScrcpy,
        infoArray: DisplayCombinedInfo[],
        handoff?: AppLinkHandoff,
    ): void {
        streamReceiver.off('disconnected', this.onDisconnected);
        const { udid, player: playerName } = params;
        // Join the virtual display already showing the app: its settings are used as they are, so that the encoder of the
        // other clients is not reset
        const running = infoArray.find((info) => {
            return info.connectionCount > 0 && info.videoSettings?.startApp === this.packageName;
        });
        let videoSettings: VideoSettings;
        let fitToScreen = false;
        if (running && running.videoSettings) {
            videoSettings = running.videoSettings;
        } else {
            videoSettings = this.createNewDisplaySettings(playerName, udid, handoff);
            fitToScreen = !!handoff?.fitToScreen && !videoSettings.flexDisplay;
        }
        const player = StreamClientScrcpy.createPlayer(playerName, udid, running?.displayInfo);
        if (!player) {
            this.showError(`Unsupported player "${playerName}"`);
            return;
        }
        this.status.remove();
        document.body.classList.remove('app-link');
        player.setVideoSettings(videoSettings, fitToScreen, false);
        StreamClientScrcpy.start({ ...params, fitToScreen }, streamReceiver, player, fitToScreen, videoSettings);
        streamReceiver.triggerInitialInfoEvents();
    }

    // Settings of the dialog that opened this window, otherwise a flex display following this window
    private createNewDisplaySettings(playerName: string, udid: string, handoff?: AppLinkHandoff): VideoSettings {
        if (handoff) {
            const settings = VideoSettings.fromBuffer(Buffer.from(handoff.videoSettings, 'base64'));
            return new VideoSettings({ ...settings.toJSON(), startApp: this.packageName });
        }
        const playerClass = StreamClientScrcpy.getPlayers().find((player) => player.playerFullName === playerName);
        const stored = playerClass ? playerClass.loadVideoSettings(udid) : new VideoSettings();
        const width = Math.max(320, (document.body.clientWidth - TOOLBOX_WIDTH) & ~15);
        const height = Math.max(240, document.body.clientHeight & ~15);
        return new VideoSettings({
            ...stored.toJSON(),
            bounds: null,
            displayId: VideoSettings.DISPLAY_ID_NEW,
            newDisplay: { width, height, dpi: 0 },
            flexDisplay: true,
            startApp: this.packageName,
        });
    }
}
