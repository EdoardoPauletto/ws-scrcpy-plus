import '../../../style/material.css';
import '../../../style/dialog.css';
import GoogDeviceDescriptor from '../../../types/GoogDeviceDescriptor';
import { DisplayCombinedInfo } from '../../client/StreamReceiver';
import VideoSettings, { NewDisplay } from '../../VideoSettings';
import { StreamClientScrcpy } from './StreamClientScrcpy';
import Size from '../../Size';
import Util from '../../Util';
import { DisplayInfo } from '../../DisplayInfo';
import SvgImage, { Icon } from '../../ui/SvgImage';
import Tooltip from '../../ui/Tooltip';
import { html } from '../../ui/HtmlTag';
import { PlayerClass } from '../../player/BasePlayer';
import { DeviceTracker } from './DeviceTracker';
import { Attribute } from '../../Attribute';
import { StreamReceiverScrcpy } from './StreamReceiverScrcpy';
import { ParamsStreamScrcpy } from '../../../types/ParamsStreamScrcpy';
import { BaseClient } from '../../client/BaseClient';
import { AppLinkClient } from './AppLinkClient';
import { DeviceApp } from '../../../common/AppLink';

interface ConfigureScrcpyEvents {
    closed: { dialog: ConfigureScrcpy; result: boolean };
}

type Range = {
    max: number;
    min: number;
    step: number;
    formatter?: (value: number) => string;
};

export class ConfigureScrcpy extends BaseClient<ParamsStreamScrcpy, ConfigureScrcpyEvents> {
    private readonly TAG: string;
    private readonly udid: string;
    private readonly escapedUdid: string;
    private readonly playerStorageKey: string;
    private deviceName: string;
    private streamReceiver?: StreamReceiverScrcpy;
    private playerName?: string;
    private displayInfo?: DisplayInfo;
    private newDisplaySelected = false;
    private readonly newDisplayClass = `new_display_${Math.random().toString(36).slice(2)}`;
    private background: HTMLElement;
    private dialogBody?: HTMLElement;
    private okButton?: HTMLButtonElement;
    private fitToScreenCheckbox?: HTMLInputElement;
    private keepActiveCheckbox?: HTMLInputElement;
    private flexDisplayCheckbox?: HTMLInputElement;
    private audioCheckbox?: HTMLInputElement;
    private audioDupCheckbox?: HTMLInputElement;
    private resetSettingsButton?: HTMLButtonElement;
    private loadSettingsButton?: HTMLButtonElement;
    private saveSettingsButton?: HTMLButtonElement;
    private playerSelectElement?: HTMLSelectElement;
    private displayIdSelectElement?: HTMLSelectElement;
    private encoderSelectElement?: HTMLSelectElement;
    private connectionStatusElement?: HTMLElement;
    private dialogContainer?: HTMLElement;
    private statusText = '';
    private connectionCount = 0;
    private readonly descriptor: GoogDeviceDescriptor;
    private appSelect?: HTMLSelectElement;
    private appInput?: HTMLInputElement;
    private newWindowCheckbox?: HTMLInputElement;
    private newWindowRow?: HTMLElement;
    private appLinkElement?: HTMLElement;

    constructor(private readonly tracker: DeviceTracker, descriptor: GoogDeviceDescriptor, params: ParamsStreamScrcpy) {
        super(params);
        this.udid = descriptor.udid;
        this.escapedUdid = Util.escapeUdid(this.udid);
        this.playerStorageKey = `configure_stream::${this.escapedUdid}::player`;
        this.descriptor = descriptor;
        this.deviceName = descriptor['ro.product.model'];
        this.TAG = `ConfigureScrcpy[${this.udid}]`;
        this.createStreamReceiver(params);
        this.setTitle(`${this.deviceName}. Configure stream`);
        this.background = this.createUI();
        this.loadApps();
    }

    public getTracker(): DeviceTracker {
        return this.tracker;
    }

    private createStreamReceiver(params: ParamsStreamScrcpy): void {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.streamReceiver = new StreamReceiverScrcpy(params);
        this.attachEventsListeners(this.streamReceiver);
    }

    private attachEventsListeners(streamReceiver: StreamReceiverScrcpy): void {
        streamReceiver.on('encoders', this.onEncoders);
        streamReceiver.on('displayInfo', this.onDisplayInfo);
        streamReceiver.on('connected', this.onConnected);
        streamReceiver.on('disconnected', this.onDisconnected);
    }

    private detachEventsListeners(streamReceiver: StreamReceiverScrcpy): void {
        streamReceiver.off('encoders', this.onEncoders);
        streamReceiver.off('displayInfo', this.onDisplayInfo);
        streamReceiver.off('connected', this.onConnected);
        streamReceiver.off('disconnected', this.onDisconnected);
    }

    private updateStatus(): void {
        if (!this.connectionStatusElement) {
            return;
        }
        let text = this.statusText;
        if (this.connectionCount) {
            text = `${text}. Other clients: ${this.connectionCount}.`;
        }
        this.connectionStatusElement.innerText = text;
    }

    private onEncoders = (encoders: string[]): void => {
        // console.log(this.TAG, 'Encoders', encoders);
        const select = this.encoderSelectElement || document.createElement('select');
        let child;
        while ((child = select.firstChild)) {
            select.removeChild(child);
        }
        encoders.unshift('');
        encoders.forEach((value) => {
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', value);
            optionElement.innerText = value;
            select.appendChild(optionElement);
        });
        this.encoderSelectElement = select;
    };

    private onDisplayInfo = (infoArray: DisplayCombinedInfo[]): void => {
        // console.log(this.TAG, 'Received info');
        this.statusText = 'Ready';
        this.updateStatus();
        this.dialogContainer?.classList.add('ready');
        const select = this.displayIdSelectElement || document.createElement('select');
        let child;
        while ((child = select.firstChild)) {
            select.removeChild(child);
        }
        let selectedOptionIdx = -1;
        infoArray.forEach((value: DisplayCombinedInfo, idx: number) => {
            const { displayInfo, videoSettings } = value;
            const { displayId, size } = displayInfo;
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', displayId.toString());
            let virtual = '';
            if (videoSettings && videoSettings.newDisplay) {
                virtual = videoSettings.startApp ? ` (virtual: ${videoSettings.startApp})` : ' (virtual)';
            }
            optionElement.innerText = `ID: ${displayId}; ${size.width}x${size.height}${virtual}`;
            select.appendChild(optionElement);
            if (
                !this.newDisplaySelected &&
                ((this.displayInfo && this.displayInfo.displayId === displayId) ||
                    (!this.displayInfo && displayId === DisplayInfo.DEFAULT_DISPLAY))
            ) {
                selectedOptionIdx = idx;
            }
        });
        const newDisplayOption = document.createElement('option');
        newDisplayOption.setAttribute('value', VideoSettings.DISPLAY_ID_NEW.toString());
        newDisplayOption.innerText = 'New virtual display';
        select.appendChild(newDisplayOption);
        if (this.newDisplaySelected) {
            select.selectedIndex = newDisplayOption.index;
        }
        this.updateNewDisplayInputs(infoArray);
        if (selectedOptionIdx > -1) {
            select.selectedIndex = selectedOptionIdx;
            const { videoSettings, connectionCount, displayInfo } = infoArray[selectedOptionIdx];
            this.displayInfo = displayInfo;
            if (connectionCount > 0 && videoSettings) {
                // console.log(this.TAG, 'Apply other clients settings');
                this.fillInputsFromVideoSettings(videoSettings, false);
            } else {
                // console.log(this.TAG, 'Apply settings for current player');
                this.updateVideoSettingsForPlayer();
            }
            this.connectionCount = connectionCount;
            this.updateStatus();
        }
        this.displayIdSelectElement = select;
        if (this.dialogBody) {
            this.dialogBody.classList.remove('hidden');
            this.dialogBody.classList.add('visible');
        }
    };

    private onConnected = (): void => {
        // console.log(this.TAG, 'Connected');
        this.statusText = 'Waiting for info...';
        this.updateStatus();
        if (this.okButton) {
            this.okButton.disabled = false;
        }
    };

    private onDisconnected = (): void => {
        // console.log(this.TAG, 'Disconnected');
        this.statusText = 'Disconnected';
        this.updateStatus();
        if (this.okButton) {
            this.okButton.disabled = true;
        }
        if (this.dialogBody) {
            this.dialogBody.classList.remove('visible');
            this.dialogBody.classList.add('hidden');
        }
    };

    private onPlayerChange = (): void => {
        this.updateVideoSettingsForPlayer();
    };

    private onDisplayIdChange = (): void => {
        const select = this.displayIdSelectElement;
        if (!select || !this.streamReceiver) {
            return;
        }
        const value = select.options[select.selectedIndex].value;
        const displayId = parseInt(value, 10);
        this.newDisplaySelected = displayId === VideoSettings.DISPLAY_ID_NEW;
        if (this.newDisplaySelected) {
            // Settings are stored per display: use the generic ones for a display which does not exist yet
            this.displayInfo = undefined;
        } else if (!isNaN(displayId)) {
            this.displayInfo = this.streamReceiver.getDisplayInfo(displayId);
        }
        this.updateNewDisplayInputs();
        this.updateVideoSettingsForPlayer();
    };

    private updateNewDisplayInputs(infoArray?: DisplayCombinedInfo[]): void {
        const flex = !!this.flexDisplayCheckbox?.checked;
        const elements = document.querySelectorAll(`.new-display-option.${this.newDisplayClass}`);
        const hasLink = !!this.getSelectedApp() && !!this.newWindowCheckbox?.checked;
        elements.forEach((element) => {
            // With a flex display, the size follows the browser window
            const fixedSizeOnly = element.classList.contains('fixed-size-option');
            const linkOnly = element.classList.contains('app-link-option');
            element.classList.toggle(
                'hidden',
                !this.newDisplaySelected || (flex && fixedSizeOnly) || (linkOnly && !hasLink),
            );
        });
        this.updateAppLink();
        if (!infoArray) {
            return;
        }
        // Without explicit values, the virtual display has the size of the main display
        const main = infoArray.find((info) => info.displayInfo.displayId === DisplayInfo.DEFAULT_DISPLAY);
        if (main) {
            const { width, height } = main.displayInfo.size;
            this.getBasicInput('newDisplayWidth')?.setAttribute('placeholder', width.toString(10));
            this.getBasicInput('newDisplayHeight')?.setAttribute('placeholder', height.toString(10));
        }
    }

    private getNewDisplay(): NewDisplay | null {
        const read = (name: string, fallback: number): number => {
            const input = this.getBasicInput(name);
            const value = input ? parseInt(input.value || input.getAttribute('placeholder') || '', 10) : NaN;
            return isNaN(value) || value < 0 ? fallback : value;
        };
        // 0: let the device scale the density of the main display (or 160 for a flex display)
        const dpi = read('newDisplayDpi', 0);
        if (this.flexDisplayCheckbox?.checked) {
            // Estimated size of the video area (next to the tool box); the stream adjusts it once opened
            const toolBoxWidth = 48;
            const width = Math.max(320, (document.body.clientWidth - toolBoxWidth) & ~15);
            const height = Math.max(240, document.body.clientHeight & ~15);
            return { width, height, dpi };
        }
        const main = this.streamReceiver?.getDisplayInfo(DisplayInfo.DEFAULT_DISPLAY);
        const width = read('newDisplayWidth', main ? main.size.width : 0);
        const height = read('newDisplayHeight', main ? main.size.height : 0);
        return { width, height, dpi };
    }

    // A settings row, Android style: leading icon, label with an info button, control(s) on the right
    private appendRow(
        parent: HTMLElement,
        opts: {
            icon: Icon;
            label: string;
            tooltip: string;
            controls: HTMLElement[];
            htmlFor?: string;
            wide?: boolean;
        },
    ): { row: HTMLElement; value: HTMLElement } {
        const row = document.createElement('div');
        row.classList.add('md-row');
        if (opts.wide) {
            row.classList.add('wide');
        }
        const icon = document.createElement('span');
        icon.classList.add('md-row-icon');
        icon.appendChild(SvgImage.create(opts.icon));
        const text = document.createElement('div');
        text.classList.add('md-row-text');
        const label = document.createElement('label');
        label.classList.add('md-row-label');
        label.innerText = opts.label;
        if (opts.htmlFor) {
            label.htmlFor = opts.htmlFor;
        }
        const info = document.createElement('button');
        info.type = 'button';
        info.classList.add('md-info');
        info.appendChild(SvgImage.create(SvgImage.Icon.INFO));
        Tooltip.attach(info, opts.tooltip);
        const value = document.createElement('span');
        value.classList.add('md-row-value');
        text.append(label, info, value);
        const control = document.createElement('div');
        control.classList.add('md-row-control');
        opts.controls.forEach((element) => control.appendChild(element));
        row.append(icon, text, control);
        parent.appendChild(row);
        return { row, value };
    }

    // A Material switch like "Fit to screen"
    private appendToggle(
        parent: HTMLElement,
        opts: { icon: Icon; label: string; id: string; tooltip: string },
    ): { input: HTMLInputElement; row: HTMLElement } {
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('role', 'switch');
        input.id = `${opts.id}_${this.escapedUdid}`;
        const toggle = html`<label class="md-switch">
            <span class="md-switch-track"><span class="md-switch-handle"></span></span>
        </label>`.content.firstElementChild as HTMLElement;
        toggle.prepend(input);
        const { icon, label, tooltip } = opts;
        const { row } = this.appendRow(parent, { icon, label, tooltip, controls: [toggle], htmlFor: input.id });
        return { input, row };
    }

    private appendSection(parent: HTMLElement, title: string): HTMLElement {
        const section = document.createElement('div');
        section.classList.add('md-section');
        const header = document.createElement('div');
        header.classList.add('md-section-title');
        header.innerText = title;
        section.appendChild(header);
        parent.appendChild(section);
        return section;
    }

    private static createButton(text: string, icon: Icon, className: string, tooltip?: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add('md-button', className);
        button.appendChild(SvgImage.create(icon));
        button.appendChild(document.createTextNode(text));
        if (tooltip) {
            Tooltip.attach(button, tooltip, false);
        }
        return button;
    }

    private get audioStorageKey(): string {
        return `configure_stream::${this.escapedUdid}::audio`;
    }

    private loadAudioPreferences(): void {
        let saved: { audio?: boolean; audioDup?: boolean } = {};
        try {
            saved = JSON.parse(window.localStorage.getItem(this.audioStorageKey) || '{}');
        } catch (error) {
            // ignore: defaults
        }
        if (this.audioCheckbox) {
            this.audioCheckbox.checked = !!saved.audio;
        }
        if (this.audioDupCheckbox) {
            this.audioDupCheckbox.checked = !!saved.audioDup;
        }
    }

    private saveAudioPreferences(audio: boolean, audioDup: boolean): void {
        try {
            window.localStorage.setItem(this.audioStorageKey, JSON.stringify({ audio, audioDup }));
        } catch (error) {
            // ignore: not persisted
        }
    }

    private getPlayer(): PlayerClass | undefined {
        if (!this.playerSelectElement) {
            return;
        }
        const playerName = this.playerSelectElement.options[this.playerSelectElement.selectedIndex].value;
        return StreamClientScrcpy.getPlayers().find((playerClass) => {
            return playerClass.playerFullName === playerName;
        });
    }

    private updateVideoSettingsForPlayer(): void {
        const player = this.getPlayer();
        if (player) {
            this.playerName = player.playerFullName;
            const storedOrPreferred = player.loadVideoSettings(this.udid, this.displayInfo);
            const fitToScreen = player.getFitToScreenStatus(this.udid, this.displayInfo);
            this.fillInputsFromVideoSettings(storedOrPreferred, fitToScreen);
        }
    }

    private getBasicInput(id: string): HTMLInputElement | null {
        const element = document.getElementById(`${id}_${this.escapedUdid}`);
        if (!element) {
            return null;
        }
        return element as HTMLInputElement;
    }

    private fillInputsFromVideoSettings(videoSettings: VideoSettings, fitToScreen: boolean): void {
        if (this.displayInfo && this.displayInfo.displayId !== videoSettings.displayId) {
            console.error(this.TAG, `Display id from VideoSettings and DisplayInfo don't match`);
        }
        if (this.keepActiveCheckbox) {
            this.keepActiveCheckbox.checked = videoSettings.keepActive;
        }
        this.fillBasicInput({ id: 'bitrate' }, videoSettings);
        this.fillBasicInput({ id: 'maxFps' }, videoSettings);
        this.fillBasicInput({ id: 'iFrameInterval' }, videoSettings);
        // this.fillBasicInput({ id: 'displayId' }, videoSettings);
        this.fillBasicInput({ id: 'codecOptions' }, videoSettings);
        if (videoSettings.bounds) {
            const { width, height } = videoSettings.bounds;
            const widthInput = this.getBasicInput('maxWidth');
            if (widthInput) {
                widthInput.value = width.toString(10);
            }
            const heightInput = this.getBasicInput('maxHeight');
            if (heightInput) {
                heightInput.value = height.toString(10);
            }
        }
        if (this.encoderSelectElement) {
            const encoderName = videoSettings.encoderName || '';
            const option = Array.from(this.encoderSelectElement.options).find((element) => {
                return element.value === encoderName;
            });
            if (option) {
                this.encoderSelectElement.selectedIndex = option.index;
            }
        }
        if (this.fitToScreenCheckbox) {
            this.fitToScreenCheckbox.checked = fitToScreen;
            this.onFitToScreenChanged(fitToScreen);
        }
    }

    private onFitToScreenChanged(checked: boolean) {
        const heightInput = this.getBasicInput('maxHeight');
        const widthInput = this.getBasicInput('maxWidth');
        if (!this.fitToScreenCheckbox || !heightInput || !widthInput) {
            return;
        }
        heightInput.disabled = widthInput.disabled = checked;
        if (checked) {
            heightInput.setAttribute(Attribute.VALUE, heightInput.value);
            heightInput.value = '';
            widthInput.setAttribute(Attribute.VALUE, widthInput.value);
            widthInput.value = '';
        } else {
            const storedHeight = heightInput.getAttribute(Attribute.VALUE);
            if (typeof storedHeight === 'string') {
                heightInput.value = storedHeight;
                heightInput.removeAttribute(Attribute.VALUE);
            }
            const storedWidth = widthInput.getAttribute(Attribute.VALUE);
            if (typeof storedWidth === 'string') {
                widthInput.value = storedWidth;
                widthInput.removeAttribute(Attribute.VALUE);
            }
        }
    }

    private fillBasicInput(opts: { id: keyof VideoSettings }, videoSettings: VideoSettings): void {
        const input = this.getBasicInput(opts.id);
        const value = videoSettings[opts.id];
        if (input) {
            if (typeof value !== 'undefined' && value !== '-' && value !== 0 && value !== null) {
                input.value = value.toString(10);
                if (input.getAttribute('type') === 'range') {
                    input.dispatchEvent(new Event('input'));
                }
            } else {
                input.value = '';
            }
        }
    }

    private createInput(id: string, type = 'text'): HTMLInputElement {
        const input = document.createElement('input');
        input.classList.add(type === 'range' ? 'md-slider' : 'md-input');
        input.type = type;
        input.id = `${id}_${this.escapedUdid}`;
        return input;
    }

    private appendBasicInput(
        parent: HTMLElement,
        opts: { icon: Icon; label: string; id: string; tooltip: string; type?: string; range?: Range },
    ): HTMLInputElement {
        const { icon, label, tooltip, range } = opts;
        const input = this.createInput(opts.id, range ? 'range' : opts.type);
        const { value } = this.appendRow(parent, {
            icon,
            label,
            tooltip,
            controls: [input],
            htmlFor: input.id,
            wide: !!range,
        });
        if (range) {
            // The current value is shown next to the label, as in Android settings
            input.oninput = () => {
                value.innerText = range.formatter ? range.formatter(parseInt(input.value, 10)) : input.value;
            };
            input.setAttribute('max', range.max.toString());
            input.setAttribute('min', range.min.toString());
            input.setAttribute('step', range.step.toString());
        }
        return input;
    }

    // Width × height in a single row
    private appendSizeInputs(
        parent: HTMLElement,
        opts: { icon: Icon; label: string; tooltip: string; widthId: string; heightId: string },
    ): HTMLElement {
        const { icon, label, tooltip } = opts;
        const width = this.createInput(opts.widthId, 'number');
        const height = this.createInput(opts.heightId, 'number');
        width.setAttribute('aria-label', `${label}: width`);
        height.setAttribute('aria-label', `${label}: height`);
        [width, height].forEach((input) => {
            input.classList.add('md-input-size');
            input.setAttribute('min', '0');
        });
        const times = document.createElement('span');
        times.classList.add('md-times');
        times.innerText = '×';
        const controls = [width, times, height];
        return this.appendRow(parent, { icon, label, tooltip, controls, htmlFor: width.id }).row;
    }

    private getNumberValueFromInput(name: string): number {
        const value = (document.getElementById(`${name}_${this.escapedUdid}`) as HTMLInputElement).value;
        return parseInt(value, 10);
    }

    private getStringValueFromInput(name: string): string {
        return (document.getElementById(`${name}_${this.escapedUdid}`) as HTMLInputElement).value;
    }

    private getValueFromSelect(name: string): string {
        const select = document.getElementById(`${name}_${this.escapedUdid}`) as HTMLSelectElement;
        return select.options[select.selectedIndex].value;
    }

    private buildVideoSettings(): VideoSettings | null {
        try {
            const bitrate = this.getNumberValueFromInput('bitrate');
            const maxFps = this.getNumberValueFromInput('maxFps');
            const iFrameInterval = this.getNumberValueFromInput('iFrameInterval');
            const maxWidth = this.getNumberValueFromInput('maxWidth');
            const maxHeight = this.getNumberValueFromInput('maxHeight');
            const displayId = this.getNumberValueFromInput('displayId');
            const codecOptions = this.getStringValueFromInput('codecOptions') || undefined;
            let bounds: Size | undefined;
            if (!isNaN(maxWidth) && !isNaN(maxHeight) && maxWidth && maxHeight) {
                bounds = new Size(maxWidth, maxHeight);
            }
            const encoderName = this.getValueFromSelect('encoderName') || undefined;
            const newDisplay = displayId === VideoSettings.DISPLAY_ID_NEW ? this.getNewDisplay() : null;
            const startApp = newDisplay ? this.getSelectedApp() : undefined;
            const flexDisplay = !!newDisplay && !!this.flexDisplayCheckbox?.checked;
            if (flexDisplay) {
                // The display size follows the window: do not limit the video size
                bounds = undefined;
            }
            return new VideoSettings({
                keepActive: !!this.keepActiveCheckbox?.checked,
                flexDisplay,
                bitrate,
                bounds,
                maxFps,
                iFrameInterval,
                displayId,
                codecOptions,
                encoderName,
                newDisplay,
                startApp,
            });
        } catch (error: any) {
            console.error(this.TAG, error.message);
            return null;
        }
    }

    private getFitToScreenValue(): boolean {
        if (!this.fitToScreenCheckbox) {
            return false;
        }
        return this.fitToScreenCheckbox.checked;
    }

    private getPreviouslyUsedPlayer(): string {
        if (!window.localStorage) {
            return '';
        }
        const result = window.localStorage.getItem(this.playerStorageKey);
        if (result) {
            return result;
        } else {
            return '';
        }
    }

    private setPreviouslyUsedPlayer(playerName: string): void {
        if (!window.localStorage) {
            return;
        }
        window.localStorage.setItem(this.playerStorageKey, playerName);
    }

    // App to start on the new virtual display, and the shareable link to its stream
    private appendAppInputs(parent: HTMLElement): void {
        const appSelect = (this.appSelect = document.createElement('select'));
        appSelect.classList.add('md-select');
        appSelect.id = `startApp_${this.escapedUdid}`;
        appSelect.disabled = true;
        appSelect.appendChild(new Option('Loading apps…', ''));
        // Fallback when the list can't be loaded
        const appInput = (this.appInput = document.createElement('input'));
        appInput.classList.add('md-input', 'hidden');
        appInput.id = `startAppPackage_${this.escapedUdid}`;
        appInput.placeholder = 'com.example.app';
        appInput.spellcheck = false;
        const appRow = this.appendRow(parent, {
            icon: Icon.MD_APPS,
            label: 'App',
            tooltip:
                'App to start on the new virtual display. If the list of the apps of the device cannot be loaded, ' +
                'type the Android package name of the app (e.g. com.android.chrome). Empty: the home screen.',
            controls: [appSelect, appInput],
            htmlFor: appSelect.id,
        }).row;
        appRow.classList.add('new-display-option', this.newDisplayClass, 'hidden');
        appSelect.addEventListener('change', () => this.updateNewDisplayInputs());
        appInput.addEventListener('input', () => this.updateNewDisplayInputs());

        const newWindow = this.appendToggle(parent, {
            icon: Icon.MD_OPEN_IN_NEW,
            label: 'Open in a new tab',
            id: 'newWindow',
            tooltip:
                'Open the stream in a new browser tab, at the address shown below (device/app). Open the same ' +
                'address from any device of your network to join this stream, or to start it again. Requires an app.',
        });
        this.newWindowCheckbox = newWindow.input;
        this.newWindowRow = newWindow.row;
        newWindow.row.classList.add('new-display-option', this.newDisplayClass, 'hidden');
        newWindow.input.addEventListener('change', () => this.updateNewDisplayInputs());

        const linkRow = document.createElement('div');
        linkRow.classList.add('md-link-row', 'new-display-option', 'app-link-option', this.newDisplayClass, 'hidden');
        const link = (this.appLinkElement = document.createElement('span'));
        link.classList.add('md-link-url');
        const copyButton = document.createElement('button');
        copyButton.type = 'button';
        copyButton.classList.add('md-icon-button');
        copyButton.appendChild(SvgImage.create(Icon.MD_CONTENT_COPY));
        Tooltip.attach(copyButton, 'Copy the link', false);
        copyButton.addEventListener('click', () => ConfigureScrcpy.copyText(link.innerText));
        linkRow.append(link, copyButton);
        parent.appendChild(linkRow);
        this.loadAppPreferences();
    }

    private get appStorageKey(): string {
        return `configure_stream::${this.escapedUdid}::app`;
    }

    private loadAppPreferences(): void {
        try {
            const saved = JSON.parse(window.localStorage.getItem(this.appStorageKey) || '{}');
            if (this.newWindowCheckbox) {
                this.newWindowCheckbox.checked = !!saved.newWindow;
            }
            if (this.appInput && typeof saved.app === 'string') {
                this.appInput.value = saved.app;
            }
        } catch (error) {
            // ignore: defaults
        }
    }

    private saveAppPreferences(): void {
        try {
            const value = { app: this.getSelectedApp() || '', newWindow: !!this.newWindowCheckbox?.checked };
            window.localStorage.setItem(this.appStorageKey, JSON.stringify(value));
        } catch (error) {
            // ignore: not persisted
        }
    }

    private loadApps(): void {
        const serverUrl = AppLinkClient.getServerUrl(this.params);
        AppLinkClient.listApps(serverUrl, this.udid)
            .then((apps) => this.fillApps(apps))
            .catch((error: Error) => {
                console.warn(this.TAG, `Could not list the apps: ${error.message}`);
                // Let the user type the package name instead
                this.appSelect?.classList.add('hidden');
                this.appInput?.classList.remove('hidden');
                if (this.appSelect && this.appInput) {
                    this.appInput.closest('.md-row')?.querySelector('label')?.setAttribute('for', this.appInput.id);
                }
                this.updateNewDisplayInputs();
            });
    }

    private fillApps(apps: DeviceApp[]): void {
        const select = this.appSelect;
        if (!select) {
            return;
        }
        const previous = this.appInput?.value || '';
        select.textContent = '';
        select.appendChild(new Option('None (home screen)', ''));
        const byName = (a: DeviceApp, b: DeviceApp) => a.name.localeCompare(b.name);
        [
            { label: 'Apps', apps: apps.filter((app) => !app.system).sort(byName) },
            { label: 'System apps', apps: apps.filter((app) => app.system).sort(byName) },
        ].forEach(({ label, apps: group }) => {
            if (!group.length) {
                return;
            }
            const optgroup = document.createElement('optgroup');
            optgroup.label = label;
            group.forEach((app) => {
                const option = new Option(app.name, app.packageName);
                option.title = app.packageName;
                optgroup.appendChild(option);
            });
            select.appendChild(optgroup);
        });
        select.value = apps.some((app) => app.packageName === previous) ? previous : '';
        select.disabled = false;
        this.updateNewDisplayInputs();
    }

    private getSelectedApp(): string | undefined {
        const usingInput = this.appInput && !this.appInput.classList.contains('hidden');
        const value = (usingInput ? this.appInput?.value : this.appSelect?.value) || '';
        return value.trim() || undefined;
    }

    private getAppLink(): string | undefined {
        const app = this.getSelectedApp();
        if (!app) {
            return;
        }
        const devicePart = AppLinkClient.getDevicePart(this.descriptor, this.tracker.getDescriptors());
        return AppLinkClient.buildLink(AppLinkClient.getServerUrl(this.params), devicePart, app);
    }

    private updateAppLink(): void {
        const link = this.getAppLink();
        if (this.appLinkElement) {
            this.appLinkElement.innerText = link || '';
        }
        // The link needs an app
        if (this.newWindowCheckbox && this.newWindowRow) {
            this.newWindowCheckbox.disabled = !link;
            this.newWindowRow.classList.toggle('disabled', !link);
        }
    }

    private static copyText(text: string): void {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(() => ConfigureScrcpy.copyTextFallback(text));
            return;
        }
        ConfigureScrcpy.copyTextFallback(text);
    }

    // navigator.clipboard is only available on https (or localhost)
    private static copyTextFallback(text: string): void {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }

    private createUI(): HTMLElement {
        const dialogName = 'configureDialog';
        const background = document.createElement('div');
        background.classList.add('dialog-background', dialogName);
        const dialogContainer = (this.dialogContainer = document.createElement('div'));
        dialogContainer.classList.add('dialog-container', dialogName);
        const dialogHeader = document.createElement('div');
        dialogHeader.classList.add('dialog-header', dialogName);
        const backButton = document.createElement('button');
        backButton.type = 'button';
        backButton.classList.add('md-icon-button');
        backButton.appendChild(SvgImage.create(Icon.ARROW_BACK));
        Tooltip.attach(backButton, 'Back to the device list', false);
        backButton.addEventListener('click', this.cancel);
        dialogHeader.appendChild(backButton);
        dialogHeader.appendChild(
            html`<div class="dialog-titles">
                <span class="dialog-title">Configure stream</span>
                <span class="dialog-subtitle">${this.deviceName}</span>
            </div>`.content,
        );

        const dialogBody = (this.dialogBody = document.createElement('div'));
        dialogBody.classList.add('dialog-body', dialogName, 'hidden');

        // Stream: how and what to show
        const stream = this.appendSection(dialogBody, 'Stream');
        const playerSelect = (this.playerSelectElement = document.createElement('select'));
        playerSelect.classList.add('md-select');
        playerSelect.id = `player_${this.escapedUdid}`;
        this.appendRow(stream, {
            icon: Icon.MOVIE,
            label: 'Player',
            tooltip:
                'How the video is decoded in the browser. WebCodecs uses hardware decoding and is the fastest ' +
                'where supported; H264 Converter plays through Media Source Extensions; Broadway.js and Tiny H264 ' +
                'decode in software and work everywhere, but use more CPU.',
            controls: [playerSelect],
            htmlFor: playerSelect.id,
        });
        const previouslyUsedPlayer = this.getPreviouslyUsedPlayer();
        StreamClientScrcpy.getPlayers().forEach((playerClass, index) => {
            const { playerFullName } = playerClass;
            const optionElement = document.createElement('option');
            optionElement.setAttribute('value', playerFullName);
            optionElement.innerText = playerFullName;
            playerSelect.appendChild(optionElement);
            if (playerFullName === previouslyUsedPlayer) {
                playerSelect.selectedIndex = index;
            }
        });
        playerSelect.onchange = this.onPlayerChange;
        this.updateVideoSettingsForPlayer();

        if (!this.displayIdSelectElement) {
            this.displayIdSelectElement = document.createElement('select');
        }
        this.displayIdSelectElement.classList.add('md-select');
        this.displayIdSelectElement.id = `displayId_${this.escapedUdid}`;
        this.displayIdSelectElement.onchange = this.onDisplayIdChange;
        this.appendRow(stream, {
            icon: Icon.DESKTOP_WINDOWS,
            label: 'Display',
            tooltip:
                'Which device screen to mirror. "New virtual display" creates a separate screen, so apps can be ' +
                'used without touching the physical one (Android 10+).',
            controls: [this.displayIdSelectElement],
            htmlFor: this.displayIdSelectElement.id,
        });
        const flexDisplay = this.appendToggle(stream, {
            icon: Icon.ASPECT_RATIO,
            label: 'Flex display',
            id: 'flexDisplay',
            tooltip: 'The virtual display follows the size of the browser window (scrcpy --flex-display).',
        });
        this.flexDisplayCheckbox = flexDisplay.input;
        flexDisplay.row.classList.add('new-display-option', this.newDisplayClass, 'hidden');
        flexDisplay.input.addEventListener('change', () => this.updateNewDisplayInputs());
        const newDisplaySize = this.appendSizeInputs(stream, {
            icon: Icon.CROP_FREE,
            label: 'Virtual display size',
            tooltip: 'Resolution of the virtual display in pixels. Empty: the size of the main display.',
            widthId: 'newDisplayWidth',
            heightId: 'newDisplayHeight',
        });
        newDisplaySize.classList.add('new-display-option', this.newDisplayClass, 'hidden', 'fixed-size-option');
        const dpiInput = this.appendBasicInput(stream, {
            icon: Icon.GRID_ON,
            label: 'Virtual display DPI',
            id: 'newDisplayDpi',
            type: 'number',
            tooltip: 'Pixel density of the virtual display: higher values make the interface smaller. Empty: auto.',
        });
        dpiInput.classList.add('md-input-size');
        dpiInput.setAttribute('min', '0');
        dpiInput.setAttribute('placeholder', 'auto');
        dpiInput.closest('.md-row')?.classList.add('new-display-option', this.newDisplayClass, 'hidden');
        this.appendAppInputs(stream);
        this.keepActiveCheckbox = this.appendToggle(stream, {
            icon: Icon.BRIGHTNESS_HIGH,
            label: 'Keep screen on',
            id: 'keepActive',
            tooltip: 'Prevent the device screen from turning off while streaming (scrcpy --keep-active).',
        }).input;

        const audio = this.appendSection(dialogBody, 'Audio');
        this.audioCheckbox = this.appendToggle(audio, {
            icon: Icon.MD_VOLUME_UP,
            label: 'Audio',
            id: 'audio',
            tooltip: 'Play the device audio in the browser (Android 11+).',
        }).input;
        this.audioDupCheckbox = this.appendToggle(audio, {
            icon: Icon.SMARTPHONE,
            label: 'Keep audio on device',
            id: 'audioDup',
            tooltip: 'Also keep playing the audio on the device (Android 13+, scrcpy --audio-dup).',
        }).input;
        this.loadAudioPreferences();

        const video = this.appendSection(dialogBody, 'Video quality');
        this.appendBasicInput(video, {
            icon: Icon.SPEED,
            label: 'Bitrate',
            id: 'bitrate',
            tooltip: 'Amount of video data per second: higher values give a sharper image but need more bandwidth.',
            range: {
                min: 524288,
                max: 8388608,
                step: 524288,
                formatter: (value) => `${(value / 1000000).toFixed(1)} Mbps`,
            },
        });
        this.appendBasicInput(video, {
            icon: Icon.TIMER,
            label: 'Max FPS',
            id: 'maxFps',
            tooltip: 'Upper limit for the frame rate. Lower it to save bandwidth and CPU.',
            range: { min: 1, max: 60, step: 1 },
        });
        this.appendBasicInput(video, {
            icon: Icon.IMAGE,
            label: 'I-Frame interval',
            id: 'iFrameInterval',
            type: 'number',
            tooltip:
                'Seconds between key frames (full images). Shorter intervals recover faster from glitches, ' +
                'longer ones use less bandwidth.',
        }).classList.add('md-input-size');
        const fitToScreen = this.appendToggle(video, {
            icon: Icon.MD_FULLSCREEN,
            label: 'Fit to screen',
            id: 'fitToScreen',
            tooltip: 'Scale the video to the browser window. When off, the video is limited to the max size below.',
        });
        this.fitToScreenCheckbox = fitToScreen.input;
        fitToScreen.input.addEventListener('change', () => this.onFitToScreenChanged(fitToScreen.input.checked));
        this.appendSizeInputs(video, {
            icon: Icon.CROP_FREE,
            label: 'Max size',
            tooltip:
                'Maximum width and height of the video: the device screen is scaled down to fit ' +
                '(disabled by Fit to screen).',
            widthId: 'maxWidth',
            heightId: 'maxHeight',
        });
        this.appendBasicInput(video, {
            icon: Icon.TUNE,
            label: 'Codec options',
            id: 'codecOptions',
            tooltip:
                'Advanced MediaCodec options for the encoder, e.g. "profile=1,level=4096" ' +
                '(scrcpy --video-codec-options).',
        });
        if (!this.encoderSelectElement) {
            this.encoderSelectElement = document.createElement('select');
        }
        this.encoderSelectElement.classList.add('md-select');
        this.encoderSelectElement.id = `encoderName_${this.escapedUdid}`;
        this.appendRow(video, {
            icon: Icon.MEMORY,
            label: 'Encoder',
            tooltip:
                'H.264 encoder used on the device. Empty: Android chooses; ' +
                'try another one if the video has artifacts.',
            controls: [this.encoderSelectElement],
            htmlFor: this.encoderSelectElement.id,
        });

        const buttonsWrapper = document.createElement('div');
        buttonsWrapper.classList.add('md-actions');
        const resetSettingsButton = (this.resetSettingsButton = ConfigureScrcpy.createButton(
            'Reset',
            Icon.RESTORE,
            'md-button-outlined',
            'Restore the default settings of this player',
        ));
        resetSettingsButton.addEventListener('click', this.resetSettings);
        const loadSettingsButton = (this.loadSettingsButton = ConfigureScrcpy.createButton(
            'Load',
            Icon.FOLDER_OPEN,
            'md-button-outlined',
            'Reload the settings saved for this player and display',
        ));
        loadSettingsButton.addEventListener('click', this.loadSettings);
        const saveSettingsButton = (this.saveSettingsButton = ConfigureScrcpy.createButton(
            'Save',
            Icon.MD_SAVE,
            'md-button-outlined',
            'Save these settings for this player and display: they are used the next time',
        ));
        saveSettingsButton.addEventListener('click', this.saveSettings);
        buttonsWrapper.append(resetSettingsButton, loadSettingsButton, saveSettingsButton);
        dialogBody.appendChild(buttonsWrapper);

        const dialogFooter = document.createElement('div');
        dialogFooter.classList.add('dialog-footer', dialogName);
        const statusElement = document.createElement('span');
        statusElement.classList.add('subtitle');
        this.connectionStatusElement = statusElement;
        dialogFooter.appendChild(statusElement);
        this.statusText = `Connecting...`;
        this.updateStatus();

        const okButton = (this.okButton = ConfigureScrcpy.createButton('Open', Icon.PLAY_ARROW, 'md-button-filled'));
        okButton.disabled = true;
        okButton.addEventListener('click', this.openStream);
        dialogFooter.appendChild(okButton);
        dialogContainer.appendChild(dialogHeader);
        dialogContainer.appendChild(dialogBody);
        dialogContainer.appendChild(dialogFooter);
        background.appendChild(dialogContainer);
        background.addEventListener('click', this.onBackgroundClick);
        document.body.appendChild(background);
        return background;
    }

    private removeUI(): void {
        Tooltip.hide();
        // Play the closing animation, then remove the dialog (the timeout covers disabled animations)
        const { background } = this;
        const remove = (): void => {
            background.remove();
        };
        background.classList.add('closing');
        this.dialogContainer?.addEventListener('animationend', remove, { once: true });
        setTimeout(remove, 300);
        this.okButton?.removeEventListener('click', this.openStream);
        // this.cancelButton?.removeEventListener('click', this.cancel);
        this.resetSettingsButton?.removeEventListener('click', this.resetSettings);
        this.loadSettingsButton?.removeEventListener('click', this.loadSettings);
        this.saveSettingsButton?.removeEventListener('click', this.saveSettings);
        this.background.removeEventListener('click', this.onBackgroundClick);
    }

    private onBackgroundClick = (event: MouseEvent): void => {
        if (event.target !== event.currentTarget) {
            return;
        }
        this.cancel();
    };

    private cancel = (): void => {
        if (this.streamReceiver) {
            this.detachEventsListeners(this.streamReceiver);
            this.streamReceiver.stop();
        }
        this.emit('closed', { dialog: this, result: false });
        this.removeUI();
    };

    private resetSettings = (): void => {
        const player = this.getPlayer();
        if (player) {
            this.fillInputsFromVideoSettings(player.getPreferredVideoSetting(), false);
        }
    };

    private loadSettings = (): void => {
        this.updateVideoSettingsForPlayer();
    };

    private saveSettings = (): void => {
        const videoSettings = this.buildVideoSettings();
        const player = this.getPlayer();
        if (videoSettings && player) {
            const fitToScreen = this.getFitToScreenValue();
            player.saveVideoSettings(this.udid, videoSettings, fitToScreen, this.displayInfo);
        }
    };

    private openStream = (): void => {
        const videoSettings = this.buildVideoSettings();
        if (!videoSettings || !this.streamReceiver || !this.playerName) {
            return;
        }
        const fitToScreen = videoSettings.flexDisplay ? false : this.getFitToScreenValue();
        const audio = !!this.audioCheckbox?.checked;
        const audioDup = !!this.audioDupCheckbox?.checked;
        this.saveAudioPreferences(audio, audioDup);
        if (this.newDisplaySelected) {
            this.saveAppPreferences();
        }
        const link = this.newDisplaySelected && this.newWindowCheckbox?.checked ? this.getAppLink() : undefined;
        if (link) {
            // The new tab opens the shareable link with these settings; this page stays on the device list.
            // A named target: opening the same link again reuses its tab
            this.setPreviouslyUsedPlayer(this.playerName);
            AppLinkClient.saveHandoff(link, { player: this.playerName, videoSettings, fitToScreen, audio, audioDup });
            window.open(link, `ws-scrcpy ${link}`);
            this.cancel();
            return;
        }
        this.detachEventsListeners(this.streamReceiver);
        this.emit('closed', { dialog: this, result: true });
        this.removeUI();
        const player = StreamClientScrcpy.createPlayer(this.playerName, this.udid, this.displayInfo);
        if (!player) {
            return;
        }
        this.setPreviouslyUsedPlayer(this.playerName);
        // return;
        player.setVideoSettings(videoSettings, fitToScreen, false);
        const params: ParamsStreamScrcpy = {
            ...this.params,
            udid: this.udid,
            fitToScreen,
            audio,
            audioDup,
        };
        StreamClientScrcpy.start(params, this.streamReceiver, player, fitToScreen, videoSettings);
        this.streamReceiver.triggerInitialInfoEvents();
    };
}
