import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: "Reddit Slideshow Spectacular!",
    description:
      "Turn an old or new Reddit feed into a full-screen, keyboard-driven media slideshow.",
    homepage_url: "https://github.com/Rio517/reddit-slideshow-spectacular",
    permissions: ["storage"],
    host_permissions: [
      // Listing JSON is fetched (with the session cookie) from these two.
      "https://old.reddit.com/*",
      "https://www.reddit.com/*",
      // Reddit image bytes, background-fetched for the perceptual-hash dedup that
      // is on by default (ADR 0006 Layer 2): the on-screen image (i.redd.it) and
      // its smaller previews. Display images load directly without a permission;
      // this access is only for hashing them to catch re-uploads.
      "https://i.redd.it/*",
      "https://preview.redd.it/*",
      "https://external-preview.redd.it/*",
      // Redgifs: resolve the direct mp4 (api) and fetch its bytes (media) in the
      // background, so the clip plays as a native, correctly-timed video.
      "https://api.redgifs.com/*",
      "https://media.redgifs.com/*",
      // Imgur .gifv → .mp4: background-fetched and played as a blob, because
      // Imgur hotlink-protects against a reddit Referer (ADR 0011).
      "https://i.imgur.com/*",
      // Streamable: resolve the mp4 via the public API (api.) and fetch the bytes
      // from the per-video CDN subdomain (cdn-*.). One wildcard covers both,
      // scoped to the streamable.com domain (ADR 0013).
      "https://*.streamable.com/*",
      // Giphy: background-fetch the transformed .mp4 from the media CDN subdomain
      // (media./media2./…), played as a blob (ADR 0014).
      "https://*.giphy.com/*",
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
      default_title: "Start Reddit Slideshow Spectacular!",
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
        description: "Start Reddit Slideshow Spectacular!",
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
