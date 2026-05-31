import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Reddit Slideshow",
    description: "Turn Reddit listings into a media slideshow.",
    permissions: ["storage"],
    host_permissions: [
      "https://old.reddit.com/*",
      "https://www.reddit.com/*",
      "https://i.redd.it/*",
      "https://v.redd.it/*",
      // Redgifs: resolve the direct mp4 (api) and fetch its bytes (media) in the
      // background, so the clip plays as a native, correctly-timed video.
      "https://api.redgifs.com/*",
      "https://media.redgifs.com/*",
    ],
    // Requested at runtime only when the user enables content-based dedup
    // (ADR 0006 Layer 2), so the background can fetch preview images to hash.
    optional_host_permissions: [
      "https://preview.redd.it/*",
      "https://external-preview.redd.it/*",
    ],
    // PNG (not SVG) so the same icons work on Chrome, which rejects SVG icons.
    // Regenerate from public/icon.svg with: npm run icons
    icons: {
      16: "icon/16.png",
      32: "icon/32.png",
      48: "icon/48.png",
      96: "icon/96.png",
      128: "icon/128.png",
    },
    action: {
      default_title: "Start Reddit Slideshow",
      default_icon: {
        16: "icon/16.png",
        32: "icon/32.png",
        48: "icon/48.png",
        128: "icon/128.png",
      },
    },
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+Shift+S" },
        description: "Start Reddit Slideshow",
      },
    },
    // Firefox-only: gecko id + data-collection declaration. Omitted on Chrome,
    // which would warn on an unrecognized key.
    ...(browser === "firefox"
      ? {
          browser_specific_settings: {
            gecko: {
              id: "reddit-slideshow@knyflores.com",
              data_collection_permissions: {
                required: ["none"],
              },
            },
          },
        }
      : {}),
  }),
});
