// Regenerates the Chrome Web Store promo tiles from the site's own brand
// (fonts, bulbs, neon wordmark, hero shot). Each tile template in scripts/promo/
// is served same-origin with docs/ (so /fonts, /icon.svg, /slideshow-demo.png
// resolve), rendered by Playwright at 2x for crisp text, then downscaled and
// flattened to an exact-size 24-bit PNG (no alpha) with ffmpeg — the format the
// Web Store requires.
//
// Needs the Playwright Chromium binary (npx playwright install chromium) and
// ffmpeg on PATH. Outputs docs/promo/<name>.png.
//
//   node scripts/promo-tiles.mjs   (or: npm run promo)

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { readFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const docsDir = join(root, "docs");
const tplDir = join(root, "scripts", "promo");
const outDir = join(docsDir, "promo");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};

// Chrome Web Store promo tile canvases.
const TILES = [
  { name: "small", width: 440, height: 280 },
  { name: "marquee", width: 1400, height: 560 },
];

// Serve docs/ statically, plus /tile/<name> from the scripts/promo templates so
// the template loads the site fonts/assets from the same origin.
function serve() {
  const server = createServer(async (req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const tile = /^\/tile\/([a-z]+)$/.exec(path);
    if (tile) {
      try {
        const html = await readFile(join(tplDir, `${tile[1]}.html`));
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        return res.end(html);
      } catch {
        return res.writeHead(404).end();
      }
    }
    const full = normalize(join(docsDir, path));
    if (!full.startsWith(docsDir)) return res.writeHead(403).end();
    const stream = createReadStream(full);
    stream.on("open", () => {
      res.writeHead(200, {
        "content-type": MIME[extname(full)] ?? "application/octet-stream",
      });
      stream.pipe(res);
    });
    stream.on("error", () => res.writeHead(404).end());
  });
  return new Promise((res) =>
    server.listen(0, "127.0.0.1", () =>
      res({ server, port: server.address().port }),
    ),
  );
}

function ffmpeg(args) {
  return new Promise((res, rej) => {
    const child = spawn("ffmpeg", ["-y", ...args], { stdio: "inherit" });
    child.on("error", rej);
    child.on("exit", (code) =>
      code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`)),
    );
  });
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const tmp = await mkdtemp(join(tmpdir(), "rs-promo-"));
  const { server, port } = await serve();
  const browser = await chromium.launch();
  try {
    for (const t of TILES) {
      const page = await browser.newPage({
        viewport: { width: t.width, height: t.height },
        deviceScaleFactor: 2,
      });
      await page.goto(`http://127.0.0.1:${port}/tile/${t.name}`, {
        waitUntil: "networkidle",
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(200);
      const raw = join(tmp, `${t.name}.png`);
      await page.screenshot({ path: raw });
      await page.close();
      // Downscale the 2x capture to the exact canvas and drop the alpha channel.
      await ffmpeg([
        "-i",
        raw,
        "-vf",
        `scale=${t.width}:${t.height}:flags=lanczos`,
        "-pix_fmt",
        "rgb24",
        join(outDir, `${t.name}.png`),
      ]);
      console.log(`wrote docs/promo/${t.name}.png (${t.width}x${t.height})`);
    }
  } finally {
    await browser.close();
    server.close();
    await rm(tmp, { recursive: true, force: true });
  }
}

await main();
