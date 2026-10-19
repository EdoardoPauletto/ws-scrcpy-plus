const TAG = '[PcmAudioPlayer]';

/**
 * Plays the raw audio sent by the device (48 kHz, stereo, signed 16-bit little-endian) with the Web Audio API.
 */
export class PcmAudioPlayer {
    private static readonly SAMPLE_RATE = 48000;
    private static readonly CHANNELS = 2;
    // Delay added before the first packet, to absorb the network jitter
    private static readonly BUFFERING_SECONDS = 0.08;
    // Above this delay the queued audio is dropped, to stay in sync with the video
    private static readonly MAX_LATENCY_SECONDS = 0.3;

    private readonly context: AudioContext;
    private nextTime = 0;

    constructor() {
        this.context = new AudioContext({ sampleRate: PcmAudioPlayer.SAMPLE_RATE, latencyHint: 'interactive' });
        // Browsers only start the audio after a user gesture
        document.addEventListener('pointerdown', this.resume, true);
        document.addEventListener('keydown', this.resume, true);
        this.resume();
    }

    private resume = (): void => {
        if (this.context.state === 'suspended') {
            this.context.resume().catch((error: Error) => {
                console.warn(TAG, `Cannot start audio: ${error.message}`);
            });
        }
    };

    public isSuspended(): boolean {
        return this.context.state === 'suspended';
    }

    public push(data: ArrayBuffer): void {
        const { CHANNELS, SAMPLE_RATE, BUFFERING_SECONDS, MAX_LATENCY_SECONDS } = PcmAudioPlayer;
        const frames = Math.floor(data.byteLength / (2 * CHANNELS));
        if (!frames || this.context.state !== 'running') {
            return;
        }
        const samples = new Int16Array(data, 0, frames * CHANNELS);
        const buffer = this.context.createBuffer(CHANNELS, frames, SAMPLE_RATE);
        for (let channel = 0; channel < CHANNELS; channel++) {
            const output = buffer.getChannelData(channel);
            for (let i = 0; i < frames; i++) {
                output[i] = samples[i * CHANNELS + channel] / 0x8000;
            }
        }
        const source = this.context.createBufferSource();
        source.buffer = buffer;
        source.connect(this.context.destination);
        const now = this.context.currentTime;
        if (this.nextTime < now || this.nextTime - now > MAX_LATENCY_SECONDS) {
            this.nextTime = now + BUFFERING_SECONDS;
        }
        source.start(this.nextTime);
        this.nextTime += buffer.duration;
    }

    public release(): void {
        document.removeEventListener('pointerdown', this.resume, true);
        document.removeEventListener('keydown', this.resume, true);
        this.context.close().catch(() => {
            // ignore
        });
    }
}
