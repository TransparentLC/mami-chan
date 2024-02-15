import MediaTagReader from "./MediaTagReader";
import MediaFileReader from "./MediaFileReader";

import type { LoadCallbackType, ByteRange, TagType } from "./types";

// Ogg 容器格式 · 陈亮的个人博客
// https://chenliang.org/2020/03/14/ogg-container-format/
// Ogg Vorbis Documentation
// https://www.xiph.org/vorbis/doc/v-comment.html
// Ogg 封装 Opus 音频流 · 陈亮的个人博客
// https://chenliang.org/2020/04/17/ogg-encapsulation-for-opus/
// Vorbis I specification
// https://xiph.org/vorbis/doc/Vorbis_I_spec.html#x1-630004.2.2
// Ogg Vorbis Documentation
// https://www.xiph.org/vorbis/doc/v-comment.html
// FLAC - Format
// https://xiph.org/flac/format.html#metadata_block_picture

const utf8Decoder = new TextDecoder;
const getStringAt = (buffer: number[], offset: number, length: number) => String.fromCharCode.apply(String, buffer.slice(offset, offset + length));
const getUTF8StringAt = (buffer: number[], offset: number, length: number) => utf8Decoder.decode(new Uint8Array(buffer.slice(offset, offset + length)));
const getLongLEAt = (buffer: number[], offset: number) => (buffer[offset++]) | (buffer[offset++] << 8) | (buffer[offset++] << 16) | (buffer[offset++] << 24);
const getLongBEAt = (buffer: number[], offset: number) => (buffer[offset++] << 24) | (buffer[offset++] << 16) | (buffer[offset++] << 8) | (buffer[offset++]);

export default class OggTagReader extends MediaTagReader {
    offset: number;
    packets: number[][];

    constructor(mediaFileReader: MediaFileReader) {
        super(mediaFileReader);
        this.offset = 0;
        this.packets = [];
    }

    static getTagIdentifierByteRange(): ByteRange {
        return {
            offset: 0,
            length: 4,
        };
    }

    static canReadTagFormat(tagIdentifier: Array<number>): boolean {
        return String.fromCharCode.apply(String, tagIdentifier.slice(0, 4)) === 'OggS';
    }

    _loadData(mediaFileReader: MediaFileReader, callbacks: LoadCallbackType): void {
        (async () => {
            try {
                // 一个page可能有完整的一个packet，或者是一个packet的中间一段，或者是上一个packet的最后一段和下一个packet的第一段
                // 下一个要读取的packet片段是否开始了新的packet
                let freshPacket = true;

                while (true) {
                    // @ts-ignore
                    await new Promise((onSuccess, onError) => mediaFileReader.loadRange([this.offset, this.offset + 27 - 1], {onSuccess, onError}));
                    const capturePattern = mediaFileReader.getStringAt(this.offset, 4); // this.offset += 4;
                    this.offset += 26;
                    // const version = mediaFileReader.getByteAt(this.offset); this.offset += 1;
                    // const headerType = mediaFileReader.getByteAt(this.offset); this.offset += 1;
                    // const granulePositionL = mediaFileReader.getLongAt(this.offset, false); this.offset += 4;
                    // const granulePositionH = mediaFileReader.getLongAt(this.offset, false); this.offset += 4;
                    // const bitstreamSerialNumber = mediaFileReader.getLongAt(this.offset, false); this.offset += 4;
                    // const pageSequenceNumber = mediaFileReader.getLongAt(this.offset, false); this.offset += 4;
                    // const checksum = mediaFileReader.getLongAt(this.offset, false); this.offset += 4;
                    const pageSegments = mediaFileReader.getByteAt(this.offset); this.offset += 1;
                    // @ts-ignore
                    await new Promise((onSuccess, onError) => mediaFileReader.loadRange([this.offset, this.offset + pageSegments - 1], {onSuccess, onError}));
                    const segmentTable = mediaFileReader.getBytesAt(this.offset, pageSegments); this.offset += pageSegments;
                    if (capturePattern !== 'OggS') throw new Error('Incorrect OGG page header');

                    // 在当前page中正在读取的packet片段长度
                    let packetLengthInPage = 0;
                    for (let i = 0; i < segmentTable.length; i++) {
                        if (freshPacket) {
                            this.packets.push([]);
                            freshPacket = false;
                            packetLengthInPage = 0;
                        }
                        packetLengthInPage += segmentTable[i];
                        // segmentTable[i]<255表示这个packet片段是最后一段（整个packet全部读完了），另一种情况是这个page读完了
                        // 这两种情况下都要保存读取到的片段
                        if (segmentTable[i] < 255 || i === segmentTable.length - 1) {
                            // @ts-ignore
                            await new Promise((onSuccess, onError) => mediaFileReader.loadRange([this.offset, this.offset + packetLengthInPage - 1], {onSuccess, onError}));
                            const packetData = mediaFileReader.getBytesAt(this.offset, packetLengthInPage); this.offset += packetLengthInPage;
                            this.packets[this.packets.length - 1] = this.packets[this.packets.length - 1].concat(packetData);
                            // 第一个packet是文件头，第二个packet是元数据，第三个packet是音频数据
                            // 所以只需要读取前两个packet
                            if ((freshPacket = segmentTable[i] < 255) && this.packets.length >= 2) return callbacks.onSuccess();
                        }
                    }
                }
            } catch (err) {
                callbacks.onError(err);
            }
        })();
    }

    _parseData(mediaFileReader: MediaFileReader, tags?: string[] | null): TagType {
        const result: TagType = {
            type: '',
            tags: {
                // title
                // artist
                // album
                // year
                // comment
                // track
                // genre
                // picture
                // lyrics
            },
        };
        const packet = this.packets[1];
        let offset: number;
        if (packet[0] === 3 && getStringAt(packet, 1, 6) === 'vorbis') {
            result.type = 'Vorbis';
            offset = 7;
        } else if (getStringAt(packet, 0, 8) === 'OpusTags') {
            result.type = 'Opus';
            offset = 8;
        } else {
            throw new Error('Unknown packet data');
        }
        const vendorLength = getLongLEAt(packet, offset); // offset += 4;
        offset += 4 + vendorLength;
        // const vendorString = getUTF8StringAt(packet, offset, vendorLength); offset += vendorLength;
        const userCommentListLength = getLongLEAt(packet, offset); offset += 4;
        for (let i = 0; i < userCommentListLength; i++) {
            const userCommentLength = getLongLEAt(packet, offset); offset += 4;
            const userComment = getUTF8StringAt(packet, offset, userCommentLength); offset += userCommentLength;
            let [id, data] = userComment.split('=', 2);
            id = id.toUpperCase();
            // result.tags[id] = {id, data};
            switch (id) {
                case 'TITLE':
                case 'ARTIST':
                case 'ALBUM':
                case 'GENRE':
                    result.tags[id.toLowerCase()] = data;
                    break;
                case 'DATE':
                case 'TRACKNUMBER':
                    result.tags[{
                        DATE: 'year',
                        TRACKNUMBER: 'track',
                    }[id]] = data;
                    break;
                case 'METADATA_BLOCK_PICTURE':
                    // node中，使用atob解码带有二进制内容的base64会出现“The string to be decoded is not correctly encoded.”错误，浏览器中没有这个问题
                    // @ts-expect-error
                    const isNode = typeof process !== 'undefined' && process?.versions?.node;
                    // @ts-expect-error
                    const pictureData: number[] = isNode ? Array.from(Buffer.from(data, 'base64')) : atob(data).split('').map(e => e.charCodeAt(0));
                    let offset = 0;
                    const type = getLongBEAt(pictureData, offset); offset += 4;
                    const mimeLength = getLongBEAt(pictureData, offset); offset += 4;
                    const mime = getStringAt(pictureData, offset, mimeLength); offset += mimeLength;
                    const descriptionLength = getLongBEAt(pictureData, offset); offset += 4;
                    const description = getStringAt(pictureData, offset, descriptionLength); // offset += descriptionLength;
                    offset += descriptionLength + 16;
                    const pictureLength = getLongBEAt(pictureData, offset); offset += 4;
                    const picture = pictureData.slice(offset, offset + pictureLength);
                    result.tags.picture = {
                        format: mime,
                        type: [
                            "Other",
                            "32x32 pixels 'file icon' (PNG only)",
                            "Other file icon",
                            "Cover (front)",
                            "Cover (back)",
                            "Leaflet page",
                            "Media (e.g. label side of CD)",
                            "Lead artist/lead performer/soloist",
                            "Artist/performer",
                            "Conductor",
                            "Band/Orchestra",
                            "Composer",
                            "Lyricist/text writer",
                            "Recording Location",
                            "During recording",
                            "During performance",
                            "Movie/video screen capture",
                            "A bright coloured fish",
                            "Illustration",
                            "Band/artist logotype",
                            "Publisher/Studio logotype",
                        ][type],
                        description,
                        data: picture,
                    };
                    break;
            }
        }

        return result;
    }
}
