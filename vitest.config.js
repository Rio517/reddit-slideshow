import { defineConfig } from "vitest/config";
import { WxtVitest } from "wxt/testing";

export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: "happy-dom",
    include: ["tests/unit/**/*.test.js"],
    // Reuse one realm per worker instead of a fresh one per file. Safe here: WXT
    // re-stubs browser/chrome per file and settings.test.js resets fakeBrowser
    // itself, so there is no cross-file state to leak.
    pool: "threads",
    isolate: false,
  },
});
