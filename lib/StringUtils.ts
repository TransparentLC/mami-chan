export type DecodedString = InternalDecodedString;

class InternalDecodedString {
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

export function readUTF16String(
    bytes: Array<number>,
    bigEndian: boolean,
    maxBytes?: number
): DecodedString {
    let ix = 0;
    let offset1 = 1,
        offset2 = 0;

    maxBytes = Math.min(maxBytes || bytes.length, bytes.length);

    if (bytes[0] == 0xfe && bytes[1] == 0xff) {
        bigEndian = true;
        ix = 2;
    } else if (bytes[0] == 0xff && bytes[1] == 0xfe) {
        bigEndian = false;
        ix = 2;
    }
    if (bigEndian) {
        offset1 = 0;
        offset2 = 1;
    }

    const arr = [];
    for (let j = 0; ix < maxBytes; j++) {
        const byte1 = bytes[ix + offset1];
        const byte2 = bytes[ix + offset2];
        const word1 = (byte1 << 8) + byte2;
        ix += 2;
        if (word1 == 0x0000) {
            break;
        } else if (byte1 < 0xd8 || byte1 >= 0xe0) {
            arr[j] = String.fromCharCode(word1);
        } else {
            const byte3 = bytes[ix + offset1];
            const byte4 = bytes[ix + offset2];
            const word2 = (byte3 << 8) + byte4;
            ix += 2;
            arr[j] = String.fromCharCode(word1, word2);
        }
    }
    return new InternalDecodedString(arr.join(""), ix);
}

export function readUTF8String(
    bytes: Array<number>,
    maxBytes?: number
): DecodedString {
    let ix = 0;
    maxBytes = Math.min(maxBytes || bytes.length, bytes.length);

    if (bytes[0] == 0xef && bytes[1] == 0xbb && bytes[2] == 0xbf) {
        ix = 3;
    }

    const arr = [];
    for (let j = 0; ix < maxBytes; j++) {
        const byte1 = bytes[ix++];
        if (byte1 == 0x00) {
            break;
        } else if (byte1 < 0x80) {
            arr[j] = String.fromCharCode(byte1);
        } else if (byte1 >= 0xc2 && byte1 < 0xe0) {
            const byte2 = bytes[ix++];
            arr[j] = String.fromCharCode(
                ((byte1 & 0x1f) << 6) + (byte2 & 0x3f)
            );
        } else if (byte1 >= 0xe0 && byte1 < 0xf0) {
            const byte2 = bytes[ix++];
            const byte3 = bytes[ix++];
            arr[j] = String.fromCharCode(
                ((byte1 & 0xff) << 12) + ((byte2 & 0x3f) << 6) + (byte3 & 0x3f)
            );
        } else if (byte1 >= 0xf0 && byte1 < 0xf5) {
            const byte2 = bytes[ix++];
            const byte3 = bytes[ix++];
            const byte4 = bytes[ix++];
            const codepoint =
                ((byte1 & 0x07) << 18) +
                ((byte2 & 0x3f) << 12) +
                ((byte3 & 0x3f) << 6) +
                (byte4 & 0x3f) -
                0x10000;
            arr[j] = String.fromCharCode(
                (codepoint >> 10) + 0xd800,
                (codepoint & 0x3ff) + 0xdc00
            );
        }
    }
    return new InternalDecodedString(arr.join(""), ix);
}

export function readNullTerminatedString(
    bytes: Array<number>,
    maxBytes?: number
): DecodedString {
    const arr = [];
    let i;

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
