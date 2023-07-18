import MediaFileReader, {
    IMediaFileReader,
    IMediaFileReaderInstance,
} from "./MediaFileReader";
import XhrFileReader from "./XhrFileReader";
// import BlobFileReader from "./BlobFileReader";
// import ArrayFileReader from "./ArrayFileReader";
import MediaTagReader from "./MediaFileReader";
import ID3v1TagReader from "./ID3v1TagReader";
import ID3v2TagReader from "./ID3v2TagReader";
import MP4TagReader from "./MP4TagReader";
import FLACTagReader from "./FLACTagReader";

import type { CallbackType, LoadCallbackType, ByteRange } from "./types";
import { IMediaTagReader } from "./MediaTagReader";
import { TagType } from "./types";

var mediaFileReaders: IMediaFileReader[] = [];
var mediaTagReaders: IMediaTagReader[] = [];

export function read(location: Object, callbacks: CallbackType) {
    new Reader(location).read(callbacks);
}

function isRangeValid(range: ByteRange, fileSize: number) {
    const invalidPositiveRange =
        range.offset >= 0 && range.offset + range.length >= fileSize;

    const invalidNegativeRange =
        range.offset < 0 &&
        (-range.offset > fileSize || range.offset + range.length > 0);

    return !(invalidPositiveRange || invalidNegativeRange);
}

export class Reader {
    _file: any;
    _tagsToRead: Array<string> = [];
    _fileReader: typeof MediaFileReader | undefined;
    _tagReader: typeof MediaTagReader | undefined;

    constructor(file: any) {
        this._file = file;
    }

    setTagsToRead(tagsToRead: Array<string>): Reader {
        this._tagsToRead = tagsToRead;
        return this;
    }

    setFileReader(fileReader: typeof MediaFileReader): Reader {
        this._fileReader = fileReader;
        return this;
    }

    setTagReader(tagReader: typeof MediaTagReader): Reader {
        this._tagReader = tagReader;
        return this;
    }

    read(callbacks: CallbackType) {
        var FileReader = this._getFileReader();
        var fileReader = new FileReader(this._file);
        var self = this;

        fileReader.init({
            onSuccess: function () {
                self._getTagReader(fileReader, {
                    onSuccess: function (TagReader: IMediaTagReader) {
                        new TagReader(fileReader)
                            .setTagsToRead(self._tagsToRead)
                            .read(callbacks);
                    },
                    onError: callbacks.onError,
                });
            },
            onError: callbacks.onError,
        });
    }

    _getFileReader(): IMediaFileReader {
        if (this._fileReader) {
            return this._fileReader;
        } else {
            return this._findFileReader();
        }
    }

    _findFileReader(): IMediaFileReader {
        for (var i = 0; i < mediaFileReaders.length; i++) {
            if (mediaFileReaders[i].canReadFile(this._file)) {
                return mediaFileReaders[i];
            }
        }

        throw new Error("No suitable file reader found for " + this._file);
    }

    _getTagReader(
        fileReader: IMediaFileReaderInstance,
        callbacks: CallbackType
    ) {
        if (this._tagReader) {
            var tagReader = this._tagReader;
            setTimeout(function () {
                callbacks.onSuccess(tagReader);
            }, 1);
        } else {
            this._findTagReader(fileReader, callbacks);
        }
    }

    _findTagReader(
        fileReader: IMediaFileReaderInstance,
        callbacks: CallbackType
    ) {
        // We don't want to make multiple fetches per tag reader to get the tag
        // identifier. The strategy here is to combine all the tag identifier
        // ranges into one and make a single fetch. This is particularly important
        // in file readers that have expensive loads like the XHR one.
        // However, with this strategy we run into the problem of loading the
        // entire file because tag identifiers might be at the start or end of
        // the file.
        // To get around this we divide the tag readers into two categories, the
        // ones that read their tag identifiers from the start of the file and the
        // ones that read from the end of the file.
        var tagReadersAtFileStart = [];
        var tagReadersAtFileEnd = [];
        var fileSize = fileReader.getSize();

        for (var i = 0; i < mediaTagReaders.length; i++) {
            var range = mediaTagReaders[i].getTagIdentifierByteRange();
            if (!isRangeValid(range, fileSize)) {
                continue;
            }

            if (
                (range.offset >= 0 && range.offset < fileSize / 2) ||
                (range.offset < 0 && range.offset < -fileSize / 2)
            ) {
                tagReadersAtFileStart.push(mediaTagReaders[i]);
            } else {
                tagReadersAtFileEnd.push(mediaTagReaders[i]);
            }
        }

        var tagsLoaded = false;
        var loadTagIdentifiersCallbacks = {
            onSuccess: function () {
                if (!tagsLoaded) {
                    // We're expecting to load two sets of tag identifiers. This flag
                    // indicates when the first one has been loaded.
                    tagsLoaded = true;
                    return;
                }

                for (var i = 0; i < mediaTagReaders.length; i++) {
                    var range = mediaTagReaders[i].getTagIdentifierByteRange();
                    if (!isRangeValid(range, fileSize)) {
                        continue;
                    }

                    try {
                        var tagIndentifier = fileReader.getBytesAt(
                            range.offset >= 0
                                ? range.offset
                                : range.offset + fileSize,
                            range.length
                        );
                    } catch (ex: any) {
                        if (callbacks.onError) {
                            callbacks.onError({
                                type: "fileReader",
                                info: ex.message,
                            });
                        }
                        return;
                    }

                    if (mediaTagReaders[i].canReadTagFormat(tagIndentifier)) {
                        callbacks.onSuccess(mediaTagReaders[i]);
                        return;
                    }
                }

                if (callbacks.onError) {
                    callbacks.onError({
                        type: "tagFormat",
                        info: "No suitable tag reader found",
                    });
                }
            },
            onError: callbacks.onError,
        };

        this._loadTagIdentifierRanges(
            fileReader,
            tagReadersAtFileStart,
            loadTagIdentifiersCallbacks
        );
        this._loadTagIdentifierRanges(
            fileReader,
            tagReadersAtFileEnd,
            loadTagIdentifiersCallbacks
        );
    }

    _loadTagIdentifierRanges(
        fileReader: IMediaFileReaderInstance,
        tagReaders: IMediaTagReader[],
        callbacks: LoadCallbackType
    ) {
        if (tagReaders.length === 0) {
            // Force async
            setTimeout(callbacks.onSuccess, 1);
            return;
        }

        var tagIdentifierRange: [number, number] = [Number.MAX_VALUE, 0];
        var fileSize = fileReader.getSize();

        // Create a super set of all ranges so we can load them all at once.
        // Might need to rethink this approach if there are tag ranges too far
        // a part from each other. We're good for now though.
        for (var i = 0; i < tagReaders.length; i++) {
            var range = tagReaders[i].getTagIdentifierByteRange();
            var start =
                range.offset >= 0 ? range.offset : range.offset + fileSize;
            var end = start + range.length - 1;

            tagIdentifierRange[0] = Math.min(start, tagIdentifierRange[0]);
            tagIdentifierRange[1] = Math.max(end, tagIdentifierRange[1]);
        }

        fileReader.loadRange(tagIdentifierRange, callbacks);
    }
}

export class Config {
    static addFileReader(fileReader: IMediaFileReader): typeof Config {
        mediaFileReaders.push(fileReader);
        return Config;
    }

    static addTagReader(tagReader: IMediaTagReader): typeof Config {
        mediaTagReaders.push(tagReader);
        return Config;
    }

    static removeTagReader(tagReader: IMediaTagReader): typeof Config {
        var tagReaderIx = mediaTagReaders.indexOf(tagReader);

        if (tagReaderIx >= 0) {
            mediaTagReaders.splice(tagReaderIx, 1);
        }

        return Config;
    }

    static EXPERIMENTAL_avoidHeadRequests() {
        XhrFileReader.setConfig({
            avoidHeadRequests: true,
        });
    }

    static setDisallowedXhrHeaders(disallowedXhrHeaders: Array<string>) {
        XhrFileReader.setConfig({
            disallowedXhrHeaders: disallowedXhrHeaders,
        });
    }

    static setXhrTimeoutInSec(timeoutInSec: number) {
        XhrFileReader.setConfig({
            timeoutInSec: timeoutInSec,
        });
    }
}

Config.addFileReader(XhrFileReader)
    // .addFileReader(BlobFileReader)
    // .addFileReader(ArrayFileReader)
    .addTagReader(ID3v2TagReader)
    .addTagReader(ID3v1TagReader)
    .addTagReader(MP4TagReader)
    .addTagReader(FLACTagReader);

export interface CommonMetadata {
    title?: string;
    artist?: string;
    album?: string;
    cover?: string;
}

export function getCommonMetadata(url: string): Promise<CommonMetadata> {
    return new Promise((resolve, reject) => {
        if (!url.startsWith("http")) {
            url = new URL(url, window.location.href).href;
        }

        read(url, {
            onSuccess(data: TagType) {
                const title = data.tags.title as string | undefined;
                const artist = data.tags.artist as string | undefined;
                const album = data.tags.album as string | undefined;

                let pictureData = data.tags.picture as any | any[] | undefined;

                if (Array.isArray(pictureData)) {
                    pictureData = pictureData.find(
                        (p: any) => p.type === "Cover (front)"
                    );
                }

                let cover: string | undefined = undefined;
                if (pictureData) {
                    const buffer = new Uint8Array(pictureData.data);
                    const type = (pictureData as any).type;
                    const blob = new Blob([buffer], { type });
                    cover = URL.createObjectURL(blob);
                }

                resolve({
                    title,
                    artist,
                    album,
                    cover,
                });
            },
            onError(error) {
                reject(error);
            },
        });
    });
}
