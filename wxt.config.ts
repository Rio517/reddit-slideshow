import { defineConfig } from "wxt";

export default defineConfig({
  manifestVersion: 3,
  manifest: {
    name: "Reddit Slideshow",
    description: "Turn old Reddit listings into a media slideshow.",
    permissions: ["storage"],
    host_permissions: [
      "https://old.reddit.com/*",
      "https://i.redd.it/*",
      "https://v.redd.it/*",
    ],
    icons: {
      16: "icon.svg",
      32: "icon.svg",
      48: "icon.svg",
      96: "icon.svg",
      128: "icon.svg",
    },
    action: {
      default_title: "Start Reddit Slideshow",
      default_icon: "icon.svg",
    },
    commands: {
      _execute_action: {
        suggested_key: { default: "Alt+Shift+S" },
        description: "Start Reddit Slideshow",
      },
    },
    browser_specific_settings: {
      gecko: {
        id: "reddit-slideshow@knyflores.com",
        data_collection_permissions: {
          required: ["none"],
        },
      },
    },
  },
});
