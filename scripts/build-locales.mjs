// Copy locales/<lang>.json -> public/_locales/<lang>/messages.json (the layout
// the browser reads; WXT copies public/ to the extension root). Source of truth
// is locales/; this output is committed and verified by i18n-catalog.test.js.
import {
  readdirSync,
  readFileSync,
  mkdirSync,
  writeFileSync,
  rmSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = join(root, "locales");
const outDir = join(root, "public", "_locales");

export function buildLocales({ write = true } = {}) {
  /** @type {Record<string, string>} */
  const outputs = {};
  for (const file of readdirSync(srcDir)) {
    if (!file.endsWith(".json")) continue;
    const lang = file.replace(/\.json$/, "");
    const parsed = JSON.parse(readFileSync(join(srcDir, file), "utf8"));
    outputs[lang] = JSON.stringify(parsed, null, 2) + "\n";
  }
  if (write) {
    rmSync(outDir, { recursive: true, force: true });
    for (const [lang, content] of Object.entries(outputs)) {
      const dest = join(outDir, lang, "messages.json");
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, content);
    }
  }
  return outputs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  buildLocales();
  console.log("Wrote public/_locales from locales/");
}
