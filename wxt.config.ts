import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Reddit Slideshow",
    description:
      "Turn an old or new Reddit feed into a full-screen, keyboard-driven media slideshow.",
    homepage_url: "https://github.com/Rio517/reddit-slideshow",
    permissions: ["storage"],
    host_permissions: [
      // Listing JSON is fetched (with the session cookie) from these two.
      "https://old.reddit.com/*",
      "https://www.reddit.com/*",
      // Redgifs: resolve the direct mp4 (api) and fetch its bytes (media) in the
      // background, so the clip plays as a native, correctly-timed video.
      "https://api.redgifs.com/*",
      "https://media.redgifs.com/*",
      // Imgur .gifv → .mp4: background-fetched and played as a blob, because
      // Imgur hotlink-protects against a reddit Referer (ADR 0011).
      "https://i.imgur.com/*",
    ],
    // Requested at runtime only when the user enables content-based dedup
    // (ADR 0006 Layer 2), so the background can fetch images to hash. i.redd.it
    // is here (not required) because it's reached *only* by that opt-in hashing;
    // display images load directly on CSP-less old.reddit without a permission.
    // Keep this list in sync with CONTENT_DEDUP_ORIGINS in entrypoints/options/main.js.
    optional_host_permissions: [
      "https://i.redd.it/*",
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
