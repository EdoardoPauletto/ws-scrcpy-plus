import { DeviceApp, deviceSlug, ResolvedDevice, sameSlug } from '../../../common/AppLink';
import { ParamsBase } from '../../../types/ParamsBase';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import VideoSettings from '../../VideoSettings';

// Settings handed from the "Configure stream" dialog to the tab it opens (same origin: localStorage)
export type AppLinkHandoff = {
    player: string;
    videoSettings: string; // VideoSettings.toBuffer(), base64
    fitToScreen: boolean;
    audio: boolean;
    audioDup: boolean;
    time: number;
};

const HANDOFF_PREFIX = 'app_link::';
const HANDOFF_MAX_AGE = 60 * 1000;

export class AppLinkClient {
    // The root URL of the ws-scrcpy server managing a device (as for the stream links of the device list)
    public static getServerUrl(params: ParamsBase): URL {
        if (params.useProxy || !params.hostname) {
            return new URL(AppLinkClient.getBasePath(), location.href);
        }
        const protocol = params.secure ? 'https:' : 'http:';
        const port = params.port ? `:${params.port}` : '';
        const pathname = params.pathname ?? AppLinkClient.getBasePath();
        return new URL(`${protocol}//${params.hostname}${port}${pathname}`);
    }

    // The pathname of the app root: a link page (<device>/<package>) declares it with <base href>
    public static getBasePath(): string {
        if (document.querySelector('base')) {
            return new URL(document.baseURI).pathname;
        }
        return location.pathname;
    }

    // The device part of a link: the model, unless another connected device has the same one
    public static getDevicePart(descriptor: GoogDeviceDescriptor, all: GoogDeviceDescriptor[]): string {
        const slug = deviceSlug(descriptor['ro.product.model'], descriptor.udid);
        const duplicate = all.some((other) => {
            return other.udid !== descriptor.udid && sameSlug(deviceSlug(other['ro.product.model'], other.udid), slug);
        });
        return duplicate ? descriptor.udid : slug;
    }

    public static buildLink(serverUrl: URL, devicePart: string, packageName: string): string {
        return new URL(`${encodeURIComponent(devicePart)}/${packageName}`, serverUrl).toString();
    }

    private static async getJson<T>(url: URL): Promise<T> {
        const response = await fetch(url.toString());
        const body = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(body.error || `${response.status} ${response.statusText}`);
        }
        return body as T;
    }

    public static async listApps(serverUrl: URL, udid: string): Promise<DeviceApp[]> {
        return this.getJson<DeviceApp[]>(new URL(`api/goog/devices/${encodeURIComponent(udid)}/apps`, serverUrl));
    }

    public static async resolveDevice(serverUrl: URL, device: string): Promise<ResolvedDevice> {
        return this.getJson<ResolvedDevice>(new URL(`api/goog/devices/${encodeURIComponent(device)}`, serverUrl));
    }

    private static getHandoffKey(link: string): string {
        return `${HANDOFF_PREFIX}${new URL(link).pathname}`;
    }

    public static saveHandoff(
        link: string,
        data: { player: string; videoSettings: VideoSettings; fitToScreen: boolean; audio: boolean; audioDup: boolean },
    ): void {
        const handoff: AppLinkHandoff = {
            ...data,
            videoSettings: data.videoSettings.toBuffer().toString('base64'),
            time: Date.now(),
        };
        try {
            localStorage.setItem(this.getHandoffKey(link), JSON.stringify(handoff));
        } catch (error) {
            // ignore: the new tab uses its own defaults
        }
    }

    // One-shot: the settings are only used by the window opened right after they were saved
    public static takeHandoff(link: string): AppLinkHandoff | undefined {
        const key = this.getHandoffKey(link);
        try {
            const value = localStorage.getItem(key);
            localStorage.removeItem(key);
            if (!value) {
                return;
            }
            const handoff = JSON.parse(value) as AppLinkHandoff;
            return Date.now() - handoff.time < HANDOFF_MAX_AGE ? handoff : undefined;
        } catch (error) {
            return;
        }
    }
}
