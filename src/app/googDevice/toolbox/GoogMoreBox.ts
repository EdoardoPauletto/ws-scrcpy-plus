import '../../../style/material.css';
import '../../../style/morebox.css';
import { BasePlayer } from '../../player/BasePlayer';
import { TextControlMessage } from '../../controlMessage/TextControlMessage';
import { CommandControlMessage } from '../../controlMessage/CommandControlMessage';
import { ControlMessage } from '../../controlMessage/ControlMessage';
import Size from '../../Size';
import DeviceMessage from '../DeviceMessage';
import VideoSettings from '../../VideoSettings';
import { StreamClientScrcpy } from '../client/StreamClientScrcpy';
import SvgImage, { Icon } from '../../ui/SvgImage';
import { html } from '../../ui/HtmlTag';

const TAG = '[GoogMoreBox]';

const COMMAND_ICONS: Map<number, Icon> = new Map([
    [ControlMessage.TYPE_EXPAND_NOTIFICATION_PANEL, Icon.MD_NOTIFICATIONS],
    [ControlMessage.TYPE_EXPAND_SETTINGS_PANEL, Icon.MD_SETTINGS],
    [ControlMessage.TYPE_COLLAPSE_PANELS, Icon.MD_EXPAND_LESS],
    [ControlMessage.TYPE_ROTATE_DEVICE, Icon.MD_SCREEN_ROTATION],
]);

export class GoogMoreBox {
    private static defaultSize = new Size(480, 480);
    private onStop?: () => void;
    private readonly holder: HTMLElement;
    private readonly input: HTMLTextAreaElement;
    private bitrateInput?: HTMLInputElement;
    private maxFpsInput?: HTMLInputElement;
    private iFrameIntervalInput?: HTMLInputElement;
    private maxWidthInput?: HTMLInputElement;
    private maxHeightInput?: HTMLInputElement;

    constructor(udid: string, private player: BasePlayer, private client: StreamClientScrcpy) {
        const playerName = player.getName();
        const videoSettings = player.getVideoSettings();
        const { displayId } = videoSettings;
        const idSuffix = `${udid}_${playerName}_${displayId}`;
        const moreBox = document.createElement('div');
        moreBox.className = 'more-box md-more-box';
        moreBox.appendChild(
            html`<div class="more-header">
                <div class="more-title">${udid}</div>
                <div class="more-subtitle">${playerName}</div>
            </div>`.content,
        );

        // Text typed on the device or exchanged through its clipboard
        const textSection = GoogMoreBox.appendSection(moreBox, 'Text and clipboard');
        const input = (this.input = document.createElement('textarea'));
        input.classList.add('md-textarea');
        input.placeholder = 'Text to type on the device or to put in its clipboard';
        textSection.appendChild(input);
        const textActions = document.createElement('div');
        textActions.className = 'more-actions';
        textSection.appendChild(textActions);
        const sendButton = GoogMoreBox.createButton('Send as keys', Icon.MD_KEYBOARD, 'md-button-tonal');
        textActions.appendChild(sendButton);
        sendButton.onclick = () => {
            if (input.value) {
                client.sendMessage(new TextControlMessage(input.value));
            }
        };

        const deviceSection = GoogMoreBox.appendSection(moreBox, 'Device');
        const codes = CommandControlMessage.Commands;
        for (const [action, command] of codes.entries()) {
            if (action === ControlMessage.TYPE_CHANGE_STREAM_PARAMETERS) {
                deviceSection.appendChild(this.createVideoSettingsBlock(command, idSuffix));
            } else if (action === CommandControlMessage.TYPE_SET_CLIPBOARD) {
                const btn = GoogMoreBox.createButton(command, Icon.MD_CONTENT_COPY, 'md-button-outlined');
                btn.onclick = () => {
                    const text = input.value;
                    if (text) {
                        client.sendMessage(CommandControlMessage.createSetClipboardCommand(text));
                    }
                };
                textActions.appendChild(btn);
            } else if (action === CommandControlMessage.TYPE_GET_CLIPBOARD) {
                const btn = GoogMoreBox.createButton(command, Icon.MD_CONTENT_PASTE, 'md-button-outlined');
                btn.onclick = () => {
                    client.sendMessage(new CommandControlMessage(action));
                };
                textActions.appendChild(btn);
            } else {
                const icon = COMMAND_ICONS.get(action) ?? Icon.MD_SETTINGS;
                const btn = GoogMoreBox.createButton(command, icon, 'md-menu-item');
                btn.onclick = () => {
                    client.sendMessage(new CommandControlMessage(action));
                };
                deviceSection.appendChild(btn);
            }
        }

        // The device screen state can't be read: assume it is on while mirroring
        const screenPower = GoogMoreBox.createSwitchRow({
            id: `screen_power_mode_${idSuffix}`,
            text: 'Device screen',
            supportingText: 'Turn the physical screen off while mirroring',
            icon: Icon.SMARTPHONE,
            checked: true,
        });
        screenPower.input.onchange = () => {
            const message = CommandControlMessage.createSetScreenPowerModeCommand(screenPower.input.checked);
            client.sendMessage(message);
        };
        deviceSection.appendChild(screenPower.row);

        const quality = GoogMoreBox.createSwitchRow({
            id: `show_video_quality_${idSuffix}`,
            text: 'Show quality stats',
            icon: Icon.MD_BAR_CHART,
            checked: BasePlayer.DEFAULT_SHOW_QUALITY_STATS,
        });
        quality.input.onchange = () => {
            player.setShowQualityStats(quality.input.checked);
        };
        deviceSection.appendChild(quality.row);

        const stop = (ev?: string | Event) => {
            if (ev && ev instanceof Event && ev.type === 'error') {
                console.error(TAG, ev);
            }
            const parent = moreBox.parentElement;
            if (parent) {
                parent.removeChild(moreBox);
            }
            if (this.onStop) {
                this.onStop();
                delete this.onStop;
            }
        };

        const stopBtn = GoogMoreBox.createButton('Disconnect', Icon.MD_LOGOUT, 'md-button-error');
        stopBtn.title = 'Stop the stream and go back to the device list';
        stopBtn.onclick = stop;
        GoogMoreBox.wrap('div', [stopBtn], moreBox, ['more-footer']);
        player.on('video-settings', this.onVideoSettings);
        this.holder = moreBox;
    }

    // "Change video settings": an expandable block with the fields and Reset / Fit / Apply
    private createVideoSettingsBlock(command: string, idSuffix: string): HTMLElement {
        const { player, client } = this;
        const videoSettings = player.getVideoSettings();
        const preferredSettings = player.getPreferredVideoSetting();
        const details = document.createElement('details');
        details.className = 'more-details';
        const summary = document.createElement('summary');
        summary.className = 'md-menu-item';
        const chevron = SvgImage.create(Icon.MD_EXPAND_MORE);
        chevron.classList.add('chevron');
        summary.append(SvgImage.create(Icon.TUNE), document.createTextNode(command), chevron);
        details.appendChild(summary);
        const fields = document.createElement('div');
        fields.className = 'more-fields';
        details.appendChild(fields);

        const createField = (id: string, label: string, value: string, placeholder: string): HTMLInputElement => {
            const field = document.createElement('div');
            field.className = 'more-field';
            const labelElement = document.createElement('label');
            labelElement.innerText = label;
            const inputElement = document.createElement('input');
            inputElement.className = 'md-input';
            inputElement.id = labelElement.htmlFor = `${id}_${idSuffix}`;
            inputElement.value = value;
            inputElement.placeholder = placeholder;
            field.append(labelElement, inputElement);
            fields.appendChild(field);
            return inputElement;
        };
        const bitrateInput = (this.bitrateInput = createField(
            'more_bitrate',
            'Bitrate (bps)',
            videoSettings.bitrate.toString(),
            `${preferredSettings.bitrate} bps`,
        ));
        const maxFpsInput = (this.maxFpsInput = createField(
            'more_max_fps',
            'Max FPS',
            videoSettings.maxFps.toString(),
            `${preferredSettings.maxFps} fps`,
        ));
        const iFrameIntervalInput = (this.iFrameIntervalInput = createField(
            'more_i_frame_interval',
            'I-Frame interval (s)',
            videoSettings.iFrameInterval.toString(),
            `${preferredSettings.iFrameInterval} seconds`,
        ));
        const { width, height } = videoSettings.bounds || client.getMaxSize() || GoogMoreBox.defaultSize;
        const pWidth = preferredSettings.bounds?.width || width;
        const pHeight = preferredSettings.bounds?.height || height;
        const maxWidthInput = (this.maxWidthInput = createField(
            'more_max_width',
            'Max width',
            width.toString(),
            `${pWidth} px`,
        ));
        const maxHeightInput = (this.maxHeightInput = createField(
            'more_max_height',
            'Max height',
            height.toString(),
            `${pHeight} px`,
        ));

        const actions = document.createElement('div');
        actions.className = 'more-actions';
        const resetButton = GoogMoreBox.createButton('Reset', Icon.RESTORE, 'md-button-outlined');
        resetButton.onclick = this.reset;
        const fitButton = GoogMoreBox.createButton('Fit', Icon.MD_FULLSCREEN, 'md-button-outlined');
        fitButton.onclick = this.fit;
        const applyButton = GoogMoreBox.createButton('Apply', Icon.MD_CHECK, 'md-button-filled');
        applyButton.onclick = () => {
            const bitrate = parseInt(bitrateInput.value, 10);
            const maxFps = parseInt(maxFpsInput.value, 10);
            const iFrameInterval = parseInt(iFrameIntervalInput.value, 10);
            if (isNaN(bitrate) || isNaN(maxFps)) {
                return;
            }
            const width = parseInt(maxWidthInput.value, 10) & ~15;
            const height = parseInt(maxHeightInput.value, 10) & ~15;
            const bounds = new Size(width, height);
            const current = player.getVideoSettings();
            const {
                lockedVideoOrientation,
                sendFrameMeta,
                displayId,
                codecOptions,
                encoderName,
                newDisplay,
                keepActive,
                flexDisplay,
                startApp,
            } = current;
            const videoSettings = new VideoSettings({
                bounds,
                bitrate,
                maxFps,
                iFrameInterval,
                lockedVideoOrientation,
                sendFrameMeta,
                displayId,
                codecOptions,
                encoderName,
                newDisplay,
                keepActive,
                flexDisplay,
                startApp,
            });
            client.sendNewVideoSetting(videoSettings);
        };
        actions.append(resetButton, fitButton, applyButton);
        fields.appendChild(actions);
        return details;
    }

    private static appendSection(parent: HTMLElement, title: string): HTMLElement {
        const section = document.createElement('div');
        section.className = 'more-section';
        const header = document.createElement('div');
        header.className = 'more-section-title';
        header.innerText = title;
        section.appendChild(header);
        parent.appendChild(section);
        return section;
    }

    private static createButton(text: string, icon: Icon, className: string): HTMLButtonElement {
        const button = document.createElement('button');
        button.type = 'button';
        button.classList.add(className);
        if (className !== 'md-menu-item') {
            button.classList.add('md-button');
        }
        button.appendChild(SvgImage.create(icon));
        button.appendChild(document.createTextNode(text));
        return button;
    }

    // A list item with a Material switch, Android settings style
    private static createSwitchRow(opts: {
        id: string;
        text: string;
        supportingText?: string;
        icon: Icon;
        checked: boolean;
    }): { row: HTMLElement; input: HTMLInputElement } {
        const row = html`<div class="more-switch-row">
            <label class="more-switch-text">
                <span>${opts.text}</span>
                <span class="more-supporting-text">${opts.supportingText || ''}</span>
            </label>
            <label class="md-switch">
                <span class="md-switch-track"><span class="md-switch-handle"></span></span>
            </label>
        </div>`.content.firstElementChild as HTMLElement;
        row.prepend(SvgImage.create(opts.icon));
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.setAttribute('role', 'switch');
        input.id = opts.id;
        input.checked = opts.checked;
        row.querySelector('.md-switch')?.prepend(input);
        const text = row.querySelector('.more-switch-text') as HTMLLabelElement;
        text.htmlFor = opts.id;
        return { row, input };
    }

    private onVideoSettings = (videoSettings: VideoSettings): void => {
        if (this.bitrateInput) {
            this.bitrateInput.value = videoSettings.bitrate.toString();
        }
        if (this.maxFpsInput) {
            this.maxFpsInput.value = videoSettings.maxFps.toString();
        }
        if (this.iFrameIntervalInput) {
            this.iFrameIntervalInput.value = videoSettings.iFrameInterval.toString();
        }
        if (videoSettings.bounds) {
            const { width, height } = videoSettings.bounds;
            if (this.maxWidthInput) {
                this.maxWidthInput.value = width.toString();
            }
            if (this.maxHeightInput) {
                this.maxHeightInput.value = height.toString();
            }
        }
    };

    private fit = (): void => {
        const { width, height } = this.client.getMaxSize() || GoogMoreBox.defaultSize;
        if (this.maxWidthInput) {
            this.maxWidthInput.value = width.toString();
        }
        if (this.maxHeightInput) {
            this.maxHeightInput.value = height.toString();
        }
    };

    private reset = (): void => {
        const preferredSettings = this.player.getPreferredVideoSetting();
        this.onVideoSettings(preferredSettings);
    };

    public OnDeviceMessage(ev: DeviceMessage): void {
        if (ev.type !== DeviceMessage.TYPE_CLIPBOARD) {
            return;
        }
        this.input.value = ev.getText();
        this.input.select();
        document.execCommand('copy');
    }

    private static wrap(
        tagName: string,
        elements: HTMLElement[],
        parent: HTMLElement,
        opt_classes?: string[],
    ): HTMLElement {
        const wrap = document.createElement(tagName);
        if (opt_classes) {
            wrap.classList.add(...opt_classes);
        }
        elements.forEach((e) => {
            wrap.appendChild(e);
        });
        parent.appendChild(wrap);
        return wrap;
    }

    public getHolderElement(): HTMLElement {
        return this.holder;
    }

    public setOnStop(listener: () => void): void {
        this.onStop = listener;
    }
}
