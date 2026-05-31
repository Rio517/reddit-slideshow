import js from "@eslint/js";
import noUnsanitized from "eslint-plugin-no-unsanitized";

export default [
  { ignores: [".wxt/**", ".output/**", "node_modules/**", "dist/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,ts}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        browser: "readonly",
        document: "readonly",
        fetch: "readonly",
        Response: "readonly",
        console: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        window: "readonly",
        Image: "readonly",
        Event: "readonly",
        Element: "readonly",
        HTMLElement: "readonly",
        HTMLInputElement: "readonly",
        HTMLOutputElement: "readonly",
        HTMLSelectElement: "readonly",
        AbortController: "readonly",
        Blob: "readonly",
        OffscreenCanvas: "readonly",
        createImageBitmap: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        defineBackground: "readonly",
        defineContentScript: "readonly",
      },
    },
    plugins: { "no-unsanitized": noUnsanitized },
    rules: {
      "no-unsanitized/method": "error",
      "no-unsanitized/property": "error",
    },
  },
];
