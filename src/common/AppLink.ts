// Shareable stream links: <pathname><device>/<package>, e.g. /SM-S908B/com.android.chrome

// The device part of a link: its model ("Pixel 7" -> "Pixel-7"), or its serial when the model is unknown
export function deviceSlug(model: string | undefined, udid: string): string {
    const slug = (model || '').trim().replace(/\s+/g, '-');
    return slug || udid;
}

export function sameSlug(a: string, b: string): boolean {
    return a.toLowerCase() === b.toLowerCase();
}

// An Android package name: at least two segments, each starting with a letter
export const PACKAGE_NAME_RE = /^[A-Za-z][\w]*(\.[A-Za-z][\w]*)+$/;

export type DeviceApp = {
    name: string;
    packageName: string;
    system: boolean;
};

export type ResolvedDevice = {
    udid: string;
    model: string;
    manufacturer: string;
};
