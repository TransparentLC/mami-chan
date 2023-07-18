import { CommonMetadata, getCommonMetadata } from "../lib/index";

//@ts-ignore VITE WHY YOU DO THIS TO ME
import testfile from "../assets/2.flac?url";

getCommonMetadata(testfile).then((data) => {
    document.body.innerHTML = renderTrackInfo(data);
});

function escapeHTML(str: string) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function renderTrackInfo(cmd: CommonMetadata) {
    return `
        <div class="track-info">
            <h1 class="title">${escapeHTML(cmd.title ?? "Unknow track")}</h1>
            <h2 class="album">${escapeHTML(cmd.album ?? "Unknow album")}</h2>
            <h3 class="artist">${escapeHTML(cmd.artist ?? "Unknow artist")}</h3>
            <img src="${cmd.cover ?? ""}" alt="Cover" />
        </div>
    `;
}
