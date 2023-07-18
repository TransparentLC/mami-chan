import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        lib: {
            entry: resolve("./lib/index.ts"),
            name: "mami-chan",
            fileName: "mami-chan",
        },
    },
});
