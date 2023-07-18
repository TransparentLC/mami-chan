import { getCommonMetadata } from "/dist/index.js";

getCommonMetadata("/assets/2.flac").then((data) => {
    document.body.innerHTML = renderTrackInfo(data);
});

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");
}

function renderTrackInfo(cmd) {
    return `
        <div class="track-info">
            <h1 class="title">${escapeHTML(cmd.title ?? "Unknow track")}</h1>
            <h2 class="album">${escapeHTML(cmd.album ?? "Unknow album")}</h2>
            <h3 class="artist">${escapeHTML(cmd.artist ?? "Unknow artist")}</h3>
            <img src="${cmd.cover ?? ""}" alt="Cover" />
        </div>
    `;
}
