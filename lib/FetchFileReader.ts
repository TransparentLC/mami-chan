import ChunkedFileData from "./ChunkedFileData";
import MediaFileReader from "./MediaFileReader";

const CHUNK_SIZE = 1024;

import type { LoadCallbackType, CallbackType } from "./types";

export default class FetchFileReader extends MediaFileReader {
    _url: string;
    _fileData: ChunkedFileData;

    static canReadFile(file: any): boolean {
        return URL.canParse(file);
    }

    constructor(url: string) {
        super();
        this._url = url;
        this._fileData = new ChunkedFileData();
    }

    _init(callbacks: LoadCallbackType): void {
        fetch(this._url, {
            method: 'HEAD',
        })
            .then(r => {
                this._size = parseInt(r.headers.get('Content-Length'));
                callbacks.onSuccess();
            })
            .catch(callbacks.onError);
    }

    loadRange(range: [number, number], callbacks: LoadCallbackType): void {
        if (this._fileData.hasDataRange(range[0], Math.min(this._size, range[1]))) {
            callbacks.onSuccess();
            return;
        }
        const requestRange = [range[0], Math.min(range[0] + Math.ceil((range[1] - range[0] + 1) / CHUNK_SIZE) * CHUNK_SIZE, this._size) - 1];
        fetch(this._url, {
            headers: {
                Range: `bytes=${requestRange[0]}-${requestRange[1]}`,
            }
        })
            .then(r => {
                if (r.status === 200 || r.status === 206) {
                    return r.arrayBuffer();
                } else {
                    throw new Error(`Unexpected HTTP status ${r.status}.`);
                }
            })
            .then(r => {
                this._fileData.addData(requestRange[0], new Uint8Array(r));
                callbacks.onSuccess();
            })
            .catch(callbacks.onError);
    }

    getByteAt(offset: number): number {
        return this._fileData.getByteAt(offset);
    }
}
