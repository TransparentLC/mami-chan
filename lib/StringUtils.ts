export type DecodedString = InternalDecodedString;

export class InternalDecodedString {
    _value: string;
    bytesReadCount: number;
    length: number;

    constructor(value: string, bytesReadCount: number) {
        this._value = value;
        this.bytesReadCount = bytesReadCount;
        this.length = value.length;
    }

    toString(): string {
        return this._value;
    }
}

const utf8Decoder = new TextDecoder;
const utf16LEDecoder = new TextDecoder('utf-16');
const utf16BEDecoder = new TextDecoder('utf-16be');

export function readUTF16String(
    bytes: Array<number>,
    bigEndian: boolean,
    maxBytes?: number
): DecodedString {
    maxBytes = Math.min(maxBytes || bytes.length, bytes.length);
    return new InternalDecodedString((bigEndian ? utf16BEDecoder : utf16LEDecoder).decode(new Uint8Array(bytes.slice(0, maxBytes))), maxBytes);
}

export function readUTF8String(
    bytes: Array<number>,
    maxBytes?: number
): DecodedString {
    maxBytes = Math.min(maxBytes || bytes.length, bytes.length);
    return new InternalDecodedString(utf8Decoder.decode(new Uint8Array(bytes.slice(0, maxBytes))), maxBytes);
}

export function readNullTerminatedString(
    bytes: Array<number>,
    maxBytes?: number
): DecodedString {
    const arr = [];
    let i: number;

    maxBytes = maxBytes || bytes.length;
    for (i = 0; i < maxBytes; ) {
        const byte1 = bytes[i++];
        if (byte1 == 0x00) {
            break;
        }
        arr[i - 1] = String.fromCharCode(byte1);
    }

    return new InternalDecodedString(arr.join(""), i);
}
