import { ControlMessage, ControlMessageInterface } from './ControlMessage';
import Position, { PositionInterface } from '../Position';

export interface ScrollControlMessageInterface extends ControlMessageInterface {
    position: PositionInterface;
    hScroll: number;
    vScroll: number;
}

export class ScrollControlMessage extends ControlMessage {
    public static PAYLOAD_LENGTH = 20;
    // scrcpy encodes scroll amounts in the [-16, 16] range as signed 16-bit fixed-point values
    private static readonly MAX_SCROLL = 16;

    constructor(readonly position: Position, readonly hScroll: number, readonly vScroll: number) {
        super(ControlMessage.TYPE_SCROLL);
    }

    /**
     * @override
     */
    public toBuffer(): Buffer {
        const buffer = Buffer.alloc(ScrollControlMessage.PAYLOAD_LENGTH + 1);
        let offset = 0;
        offset = buffer.writeUInt8(this.type, offset);
        offset = buffer.writeUInt32BE(this.position.point.x, offset);
        offset = buffer.writeUInt32BE(this.position.point.y, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.width, offset);
        offset = buffer.writeUInt16BE(this.position.screenSize.height, offset);
        offset = buffer.writeInt16BE(ScrollControlMessage.toFixedPoint(this.hScroll), offset);
        offset = buffer.writeInt16BE(ScrollControlMessage.toFixedPoint(this.vScroll), offset);
        buffer.writeInt32BE(0, offset); // buttons
        return buffer;
    }

    private static toFixedPoint(value: number): number {
        const clamped = Math.max(-1, Math.min(1, value / ScrollControlMessage.MAX_SCROLL));
        return Math.max(-0x8000, Math.min(0x7fff, Math.round(clamped * 0x8000)));
    }

    public toString(): string {
        return `ScrollControlMessage{hScroll=${this.hScroll}, vScroll=${this.vScroll}, position=${this.position}}`;
    }

    public toJSON(): ScrollControlMessageInterface {
        return {
            type: this.type,
            position: this.position.toJSON(),
            hScroll: this.hScroll,
            vScroll: this.vScroll,
        };
    }
}
