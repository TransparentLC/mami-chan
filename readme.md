# mami-chan

mami-chan 是一个将 [jsmediatags](https://github.com/aadsm/jsmediatags) 用 TypeScript 重写的版本。

这个 Fork 额外进行的修改如下：

* 添加了对 Ogg (Vorbis/Opus) 格式的支持（[jsmediatags#25](https://github.com/aadsm/jsmediatags/issues/25)）。
* 删除 `XhrFileReader`，另外编写了一个 `FetchFileReader` 作为替代，方便在 Node.js 下使用。

以下是原版 README 内容。

---

# jsmediatags TS kinda port

i borrowed the old FlowJS source code from https://github.com/aadsm/jsmediatags,
and ruined my life by trying to translate it to typescript
