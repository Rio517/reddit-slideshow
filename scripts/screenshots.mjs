// Regenerates the options-page screenshots (light + dark) used in the README.
// Builds the Firefox extension, serves its output statically, then drives
// Chromium via Playwright to render entrypoints/options/index.html.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const outDir = join(root, ".output", "firefox-mv3");
const shotsDir = join(root, "docs", "screenshots");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

function run(cmd, args) {
  return new Promise((res, rej) => {
    const child = spawn(cmd, args, { cwd: root, stdio: "inherit" });
    child.on("error", rej);
    child.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`)),
    );
  });
}

// Minimal static file server scoped to the build output dir.
function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const full = normalize(join(dir, path === "/" ? "/index.html" : path));
    if (!full.startsWith(dir)) {
      res.writeHead(403).end();
      return;
    }
    const stream = createReadStream(full);
    stream.on("open", () => {
      res.writeHead(200, {
        "content-type": MIME[extname(full)] ?? "application/octet-stream",
      });
      stream.pipe(res);
    });
    stream.on("error", () => res.writeHead(404).end());
  });
  return new Promise((res) => {
    server.listen(0, "127.0.0.1", () =>
      res({ server, port: server.address().port }),
    );
  });
}

// Set representative control states so the shot looks like a real config.
// main.js throws (no browser.storage outside the extension), so the form is
// left at HTML defaults until we drive it here.
function applyState() {
  const check = (id, on) => {
    const el = document.getElementById(id);
    if (el) el.checked = on;
  };
  check("autoplay", true);
  check("startMuted", true);
  check("includeNsfw", false);
  check("dedupe", true);
  check("alwaysShowMeta", true);
  check("contentDedup", false);
  check("panZoom", true);

  const card = document.getElementById("panZoomCard");
  if (card) card.dataset.off = "false";

  const transition = document.getElementById("transition");
  if (transition) transition.value = "fade";

  for (const radio of document.querySelectorAll('input[name="timerBar"]')) {
    radio.checked = radio.value === "video";
  }

  const maxLoad = document.getElementById("maxLoadWaitSeconds");
  const maxLoadOut = document.getElementById("maxLoadWaitValue");
  if (maxLoad) maxLoad.value = "8";
  if (maxLoadOut) maxLoadOut.textContent = "8";
}

async function main() {
  await run("npm", ["run", "build:firefox"]);
  await mkdir(shotsDir, { recursive: true });

  const { server, port } = await serve(outDir);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 560, height: 900 },
    });
    await page.goto(`http://127.0.0.1:${port}/options.html`, {
      waitUntil: "domcontentloaded",
    });
    await page.evaluate(applyState);

    for (const scheme of ["dark", "light"]) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.screenshot({
        path: join(shotsDir, `options-${scheme}.png`),
        fullPage: true,
      });
    }
  } finally {
    await browser.close();
    server.close();
  }
}

await main();
