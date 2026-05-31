// esbuild aliases `wxt/browser` to this when bundling the offline screenshot
// harness, so modules that import it (e.g. lib/settings.js) bundle for a plain
// page. The harness never calls the extension APIs - it injects its own
// getSettings/saveSettings - so an empty object is enough.
export const browser = {};
export default { browser };
