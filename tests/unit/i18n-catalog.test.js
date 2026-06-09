import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildLocales } from "../../scripts/build-locales.mjs";
import enRaw from "../../locales/en.json";

/** @type {Record<string, { message: string; placeholders?: Record<string, unknown> }>} */
const en = /** @type {any} */ (enRaw);
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const enKeys = Object.keys(en).sort();
const locales = ["en", "es", "fr", "de", "it", "ar"];

/** @param {string} lang */
function loadSource(lang) {
  return JSON.parse(
    readFileSync(join(root, "locales", `${lang}.json`), "utf8"),
  );
}

describe("locale catalogs", () => {
  it("public/_locales is in sync with locales/ (run `npm run locales`)", () => {
    const expected = buildLocales({ write: false });
    for (const lang of Object.keys(expected)) {
      const onDisk = readFileSync(
        join(root, "public", "_locales", lang, "messages.json"),
        "utf8",
      );
      expect(onDisk).toBe(expected[lang]);
    }
  });

  it.each(locales)("%s has exactly the English key set", (lang) => {
    const keys = Object.keys(loadSource(lang)).sort();
    expect(keys).toEqual(enKeys);
  });

  it.each(locales)("%s has matching placeholders per key", (lang) => {
    const cat = loadSource(lang);
    for (const key of enKeys) {
      const expected = Object.keys(en[key].placeholders ?? {}).sort();
      const actual = Object.keys(cat[key].placeholders ?? {}).sort();
      expect(actual, `${lang}/${key} placeholders`).toEqual(expected);
    }
  });
});
