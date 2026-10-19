import { ACTION } from '../common/Action';
import { ParamsStream } from './ParamsStream';
import VideoSettings from '../app/VideoSettings';

export interface ParamsStreamScrcpy extends ParamsStream {
    action: ACTION.STREAM_SCRCPY;
    ws: string;
    fitToScreen?: boolean;
    videoSettings?: VideoSettings;
    captureKeyboard?: boolean;
    // forward the device audio (Android 11+)
    audio?: boolean;
    // keep playing the audio on the device too (Android 13+)
    audioDup?: boolean;
}
