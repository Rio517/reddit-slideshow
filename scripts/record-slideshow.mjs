// Renders the REAL overlay over the three demo slides (record-harness.js) and
// screenshots each settled slide into RS_OUT (default the media dir). ffmpeg then
// crossfades shot1/2/3 (+ a wrap back to shot1) into the looping hero webm.
//
// Media files are fulfilled locally (i.redd.it is never hit): put puppy.png,
// cat1.png, cat2.gif in RS_MEDIA (default /tmp/rs-media). Needs the Playwright
// Chromium binary (npx playwright install chromium).
//
//   RS_MEDIA=/tmp/rs-media RS_OUT=/tmp/rs-media node scripts/record-slideshow.mjs

import { createServer } from "node:http";
import { cp, mkdtemp, rm, readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import { build } from "esbuild";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const harnessSrc = join(root, "scripts", "slideshow-harness");
const mediaDir = process.env.RS_MEDIA ?? "/tmp/rs-media";
const outDir = process.env.RS_OUT ?? mediaDir;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

// i.redd.it path -> [local file, content type].
const FILES = {
  "/cpkr7nfk7j4h1.png": ["puppy.png", "image/png"],
  "/6pazgvbx5j4h1.png": ["cat1.png", "image/png"],
  "/rs-catgif.gif": ["cat2.gif", "image/gif"],
};

function serve(dir) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
    const full = normalize(join(dir, path === "/" ? "/index.html" : path));
    if (!full.startsWith(dir)) return res.writeHead(403).end();
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

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "rs-rec-"));
  await build({
    entryPoints: [join(harnessSrc, "record-harness.js")],
    bundle: true,
    format: "esm",
    outfile: join(dir, "harness.js"),
    alias: { "wxt/browser": join(harnessSrc, "stub-browser.js") },
    loader: { ".css": "text" },
    logLevel: "silent",
  });
  await cp(join(harnessSrc, "index.html"), join(dir, "index.html"));

  const { server, port } = await serve(dir);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 800 },
    });
    await page.route("https://i.redd.it/**", async (route) => {
      const { pathname } = new URL(route.request().url());
      const entry = FILES[pathname];
      if (!entry) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({
        contentType: entry[1],
        body: await readFile(join(mediaDir, entry[0])),
      });
    });
    await page.goto(`http://127.0.0.1:${port}/index.html`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("#reddit-slideshow-root", {
      state: "visible",
      timeout: 20000,
    });
    await page.waitForSelector("img.reddit-slideshow-media", {
      state: "visible",
      timeout: 20000,
    });

    for (let i = 1; i <= 3; i++) {
      // Let the slide decode and the fade settle, and keep the controls awake.
      await page.waitForTimeout(1000);
      await page.mouse.move(640, 720);
      await page.waitForTimeout(150);
      await page.screenshot({ path: join(outDir, `shot${i}.png`) });
      console.log(`captured shot${i}.png`);
      if (i < 3) {
        // Click the rail's next control (pierces the shadow root); the keydown
        // path needs real focus the headless page doesn't carry.
        await page.mouse.move(700, 400);
        await page.waitForTimeout(150);
        await page.click('[aria-label="Next (→)"]');
      }
    }
  } finally {
    await browser.close();
    server.close();
    await rm(dir, { recursive: true, force: true });
  }
}

await main();
