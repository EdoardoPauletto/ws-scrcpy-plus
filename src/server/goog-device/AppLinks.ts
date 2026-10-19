import express, { Express, Request, Response } from 'express';
import * as fs from 'fs';
import path from 'path';
import { ControlCenter } from './services/ControlCenter';
import { SERVER_JAR_PATH } from './ScrcpyServer';
import { SERVER_PACKAGE, SERVER_VERSION } from '../../common/Constants';
import { DeviceState } from '../../common/DeviceState';
import { DeviceApp, deviceSlug, PACKAGE_NAME_RE, ResolvedDevice, sameSlug } from '../../common/AppLink';
import GoogDeviceDescriptor from '../../types/GoogDeviceDescriptor';

const TAG = '[AppLinks]';
// The scrcpy server lists the launchable apps (with their labels) and exits; cleanup=false keeps the jar on the device
const LIST_APPS_COMMAND =
    `CLASSPATH=${SERVER_JAR_PATH} app_process / ${SERVER_PACKAGE} ${SERVER_VERSION} ` +
    'list_apps=true cleanup=false log_level=info';
const APPS_CACHE_TTL = 5 * 60 * 1000;

/**
 * HTTP endpoints for the apps of a device and the shareable stream links (<pathname><device>/<package>).
 */
export class AppLinks {
    private static appsCache: Map<string, { time: number; apps: DeviceApp[] }> = new Map();

    public static register(app: Express, pathname: string, publicDir: string): void {
        const router = express.Router();
        router.use('/api/goog', (_req, res, next) => {
            // The device list of a remote host can be shown by another ws-scrcpy instance
            res.set('Access-Control-Allow-Origin', '*');
            next();
        });
        router.get('/api/goog/devices/:device', this.onResolveDevice);
        router.get('/api/goog/devices/:device/apps', this.onListApps);
        router.get('/:device/:packageName', (req, res, next) => {
            if (!PACKAGE_NAME_RE.test(req.params.packageName)) {
                next();
                return;
            }
            this.sendIndex(res, pathname, publicDir);
        });
        app.use(pathname, router);
    }

    // The app is served from a sub-path: <base> keeps its relative URLs (bundle, styles, workers) pointing to the root
    private static sendIndex(res: Response, pathname: string, publicDir: string): void {
        fs.readFile(path.join(publicDir, 'index.html'), 'utf-8', (error, html) => {
            if (error) {
                res.status(500).send(error.message);
                return;
            }
            const base = pathname.endsWith('/') ? pathname : `${pathname}/`;
            res.type('html').send(html.replace('<head>', `<head><base href="${base}">`));
        });
    }

    private static findDescriptor(device: string): GoogDeviceDescriptor | undefined {
        const descriptors = ControlCenter.getInstance()
            .getDevices()
            .filter((descriptor) => descriptor.state === DeviceState.DEVICE);
        const byUdid = descriptors.find((descriptor) => descriptor.udid === device);
        if (byUdid) {
            return byUdid;
        }
        return descriptors.find((descriptor) => {
            return sameSlug(deviceSlug(descriptor['ro.product.model'], descriptor.udid), device);
        });
    }

    private static onResolveDevice = async (req: Request, res: Response): Promise<void> => {
        const descriptor = AppLinks.findDescriptor(req.params.device);
        if (!descriptor) {
            res.status(404).json({ error: `Device "${req.params.device}" is not connected` });
            return;
        }
        const device = ControlCenter.getInstance().getDevice(descriptor.udid);
        try {
            // A link may be opened before anybody started the server on this device
            if (device && descriptor.pid === -1) {
                await device.startServer();
            }
        } catch (error: any) {
            res.status(500).json({ error: `Failed to start the server: ${error.message}` });
            return;
        }
        const resolved: ResolvedDevice = {
            udid: descriptor.udid,
            model: descriptor['ro.product.model'],
            manufacturer: descriptor['ro.product.manufacturer'],
        };
        res.json(resolved);
    };

    private static onListApps = async (req: Request, res: Response): Promise<void> => {
        const descriptor = AppLinks.findDescriptor(req.params.device);
        const device = descriptor && ControlCenter.getInstance().getDevice(descriptor.udid);
        if (!descriptor || !device) {
            res.status(404).json({ error: `Device "${req.params.device}" is not connected` });
            return;
        }
        const cached = AppLinks.appsCache.get(descriptor.udid);
        if (cached && Date.now() - cached.time < APPS_CACHE_TTL && req.query.refresh === undefined) {
            res.json(cached.apps);
            return;
        }
        try {
            // Make sure that the server jar (current version) is on the device
            await device.startServer();
            const output = await device.runShellCommandAdbKit(LIST_APPS_COMMAND);
            const apps = AppLinks.parseAppList(output);
            if (!apps.length) {
                console.error(TAG, `No apps in the output of "${LIST_APPS_COMMAND}":\n${output}`);
                res.status(500).json({ error: 'The device did not return any app' });
                return;
            }
            AppLinks.appsCache.set(descriptor.udid, { time: Date.now(), apps });
            res.json(apps);
        } catch (error: any) {
            res.status(500).json({ error: error.message });
        }
    };

    /**
     * Parse the output of the scrcpy "list_apps" option:
     * <pre>
     * [server] INFO: List of apps:
     *  * Camera                         com.sec.android.app.camera
     *  - A name longer than 30 characters......
     *                                   com.example.app
     * </pre>
     * "*" marks the system apps.
     */
    public static parseAppList(output: string): DeviceApp[] {
        const lines = output.split(/\r?\n/);
        const start = lines.findIndex((line) => line.includes('List of apps:'));
        const apps: DeviceApp[] = [];
        if (start === -1) {
            return apps;
        }
        for (let i = start + 1; i < lines.length; i++) {
            const match = lines[i].match(/^ ([*-]) (.*)$/);
            if (!match) {
                continue;
            }
            const system = match[1] === '*';
            const rest = match[2];
            const inline = rest.match(/^(.*?)\s{2,}(\S+)\s*$/);
            if (inline && PACKAGE_NAME_RE.test(inline[2])) {
                apps.push({ name: inline[1], packageName: inline[2], system });
                continue;
            }
            // A long name: the package is on the next line
            const next = (lines[i + 1] || '').match(/^\s+(\S+)\s*$/);
            if (next && PACKAGE_NAME_RE.test(next[1])) {
                apps.push({ name: rest.trim(), packageName: next[1], system });
                i++;
            }
        }
        return apps;
    }
}
