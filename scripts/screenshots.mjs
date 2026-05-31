// Regenerates the README screenshots: the options page (light + dark) and a
// live slideshow shot over r/aww. Options shots build firefox-mv3, serve it
// statically, and drive Chromium to render entrypoints/options/index.html. The
// slideshow shot builds chrome-mv3, loads it as an unpacked extension, and lets
// the content script auto-start over real r/aww media. The live capture is
// best-effort: any network/Reddit failure is logged and skipped, never fatal.

import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const outDir = join(root, ".output", "firefox-mv3");
const chromeOutDir = join(root, ".output", "chrome-mv3");
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

// A real desktop Chrome UA; headless Chrome's default UA gets extra scrutiny.
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36";

// Capture the live overlay over a SFW subreddit (r/aww, public listing JSON).
// Loads the built chrome-mv3 as an unpacked extension; the content script
// auto-starts the slideshow because the URL carries the #rs-slideshow marker.
// old.reddit.com is used (not www): www serves a JS bot-challenge to headless
// that navigates away and drops the hash, while old serves the listing directly.
// Best-effort: any failure (Reddit blocked, no media in time) is logged and
// swallowed so the options shots and overall script still succeed.
async function captureSlideshow() {
  await run("npm", ["run", "build:chrome"]);

  // Persistent context is the only way to load an unpacked MV3 extension.
  // --headless=new keeps it headless while still running the extension.
  const userDataDir = await mkdtemp(join(tmpdir(), "rs-shots-"));
  let context;
  try {
    context = await chromium.launchPersistentContext(userDataDir, {
      channel: "chromium",
      headless: true,
      viewport: { width: 1280, height: 800 },
      args: [
        "--headless=new",
        `--user-agent=${DESKTOP_UA}`,
        `--disable-extensions-except=${chromeOutDir}`,
        `--load-extension=${chromeOutDir}`,
      ],
    });

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto("https://old.reddit.com/r/aww/#rs-slideshow", {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    // Wait for the overlay to mount and a real image/video to render.
    await page.waitForSelector("#reddit-slideshow-root", {
      state: "visible",
      timeout: 20000,
    });
    await page.waitForSelector(
      "img.reddit-slideshow-media, video.reddit-slideshow-media",
      { state: "visible", timeout: 20000 },
    );

    // Let the first slide decode and the control rail settle.
    await page.waitForTimeout(2500);

    await page.screenshot({
      path: join(shotsDir, "slideshow.png"),
      fullPage: false,
    });
    console.log("captured docs/screenshots/slideshow.png");
  } catch (err) {
    console.warn(
      `WARNING: live r/aww slideshow capture skipped (${err?.message ?? err}). ` +
        "Options shots are unaffected.",
    );
  } finally {
    await context?.close();
    await rm(userDataDir, { recursive: true, force: true });
  }
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

  await captureSlideshow();
}

await main();
