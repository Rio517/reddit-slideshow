import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "../../lib/background-router.js";

const RUNTIME_ID = "self@example";
// A content-script sender: own extension id + a tab (extension pages have none).
const OWN = { id: RUNTIME_ID, tab: { id: 1 } };

function makeRouter(overrides = {}) {
  return createMessageRouter({
    runtimeId: RUNTIME_ID,
    fetchQueuePage: async () => ({
      slides: [{ id: "a" }],
      after: "t3_x",
      postsScanned: 50,
      exhausted: false,
    }),
    hashImage: async () => "0011223344556677",
    ...overrides,
  });
}

describe("createMessageRouter - sender validation", () => {
  it("ignores messages from a foreign sender", () => {
    const router = makeRouter();
    expect(
      router(
        { type: "slideshow.requestPage", payload: { pageUrl: "x" } },
        { id: "someone-else" },
      ),
    ).toBeUndefined();
  });

  it("ignores messages with no sender id", () => {
    const router = makeRouter();
    expect(router({ type: "slideshow.requestPage" }, {})).toBeUndefined();
  });

  it("ignores unknown message types from own sender", () => {
    const router = makeRouter();
    expect(router({ type: "slideshow.unknown" }, OWN)).toBeUndefined();
  });
});

describe("createMessageRouter - requestPage", () => {
  it("returns a built page for a valid request", async () => {
    const router = makeRouter();
    const result = await router(
      {
        type: "slideshow.requestPage",
        payload: { pageUrl: "https://old.reddit.com/r/x/" },
      },
      OWN,
    );
    expect(result).toMatchObject({
      ok: true,
      page: { after: "t3_x", postsScanned: 50, exhausted: false },
    });
  });

  it("passes the after cursor through", async () => {
    /** @type {Array<{ pageUrl: string, options: any }>} */
    const calls = [];
    const router = makeRouter({
      fetchQueuePage: async (
        /** @type {string} */ pageUrl,
        /** @type {any} */ options,
      ) => {
        calls.push({ pageUrl, options });
        return { slides: [], after: null, postsScanned: 0, exhausted: true };
      },
    });
    await router(
      {
        type: "slideshow.requestPage",
        payload: { pageUrl: "https://old.reddit.com/r/x/", after: "t3_y" },
      },
      OWN,
    );
    expect(calls[0].options).toEqual({ after: "t3_y" });
  });

  it("rejects a missing page url", async () => {
    const router = makeRouter();
    const result = await router(
      { type: "slideshow.requestPage", payload: {} },
      OWN,
    );
    expect(result).toMatchObject({
      ok: false,
      error: { code: "missing-page-url" },
    });
  });

  it("returns an error payload when the fetch fails", async () => {
    const router = makeRouter({
      fetchQueuePage: async () => {
        throw Object.assign(new Error("boom"), {
          name: "RedditListingFetchError",
          status: 403,
        });
      },
    });
    const result = await router(
      {
        type: "slideshow.requestPage",
        payload: { pageUrl: "https://old.reddit.com/r/x/" },
      },
      OWN,
    );
    expect(result).toMatchObject({ ok: false, error: { status: 403 } });
  });

  it("rejects a listing fetch from a non-content-script sender (no tab)", async () => {
    /** @type {string[]} */
    const fetched = [];
    const router = makeRouter({
      fetchQueuePage: async (/** @type {string} */ pageUrl) => {
        fetched.push(pageUrl);
        return { slides: [], after: null, postsScanned: 0, exhausted: true };
      },
    });
    const result = await router(
      {
        type: "slideshow.requestPage",
        payload: { pageUrl: "https://old.reddit.com/r/x/" },
      },
      { id: RUNTIME_ID }, // an extension page: own id, but no tab
    );
    expect(result).toEqual({ ok: false });
    // The session-authenticated fetch must never run for an untrusted caller.
    expect(fetched).toEqual([]);
  });
});

describe("createMessageRouter - hashImage", () => {
  it("returns the hash for a valid url", async () => {
    const router = makeRouter();
    const result = await router(
      {
        type: "slideshow.hashImage",
        payload: { url: "https://i.redd.it/a.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: true, hash: "0011223344556677" });
  });

  it("hashes an i.imgur.com image (Imgur dedup, ADR 0015)", async () => {
    const router = makeRouter();
    const result = await router(
      {
        type: "slideshow.hashImage",
        payload: { url: "https://i.imgur.com/XV5chUH.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: true, hash: "0011223344556677" });
  });

  it("passes a null hash through (undecodable image)", async () => {
    const router = makeRouter({ hashImage: async () => null });
    const result = await router(
      {
        type: "slideshow.hashImage",
        payload: { url: "https://i.redd.it/a.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: true, hash: null });
  });

  it("fails closed when hashing rejects", async () => {
    const router = makeRouter({
      hashImage: async () => {
        throw new Error("blocked");
      },
    });
    const result = await router(
      {
        type: "slideshow.hashImage",
        payload: { url: "https://i.redd.it/a.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: false });
  });

  it("rejects a non-Reddit-image host without hashing", async () => {
    let called = false;
    const router = makeRouter({
      hashImage: async () => {
        called = true;
        return "deadbeefdeadbeef";
      },
    });
    const result = await router(
      {
        type: "slideshow.hashImage",
        payload: { url: "https://evil.example/x.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: false });
    expect(called).toBe(false);
  });

  it("rejects a cleartext http URL on an allowlisted host", async () => {
    let called = false;
    const router = makeRouter({
      hashImage: async () => {
        called = true;
        return "deadbeefdeadbeef";
      },
    });
    const result = await router(
      {
        type: "slideshow.hashImage",
        payload: { url: "http://i.redd.it/a.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: false });
    expect(called).toBe(false);
  });

  it("rejects a missing url", async () => {
    const router = makeRouter();
    expect(
      await router({ type: "slideshow.hashImage", payload: {} }, OWN),
    ).toEqual({ ok: false });
  });

  it("rejects a privileged hash from a non-content-script sender (no tab)", async () => {
    const router = makeRouter();
    const result = await router(
      {
        type: "slideshow.hashImage",
        payload: { url: "https://i.redd.it/a.jpg" },
      },
      { id: RUNTIME_ID }, // an extension page: own id, but no tab
    );
    expect(result).toEqual({ ok: false });
  });
});

describe("createMessageRouter - fetchMedia", () => {
  it("returns base64 bytes for a Redgifs media url", async () => {
    const router = makeRouter({
      fetchMediaBytes: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    const result = await router(
      {
        type: "slideshow.fetchMedia",
        payload: { url: "https://media.redgifs.com/X.mp4" },
      },
      OWN,
    );
    // Base64, not a raw ArrayBuffer (which Chrome drops over the message bound.).
    expect(result).toEqual({ ok: true, b64: "AQID" });
  });

  it("returns base64 bytes for an Imgur .mp4 media url", async () => {
    const router = makeRouter({
      fetchMediaBytes: async () => new ArrayBuffer(16),
    });
    const result = await router(
      {
        type: "slideshow.fetchMedia",
        payload: { url: "https://i.imgur.com/AbCdEf1.mp4" },
      },
      OWN,
    );
    expect(result.ok).toBe(true);
    expect(typeof result.b64).toBe("string");
  });

  it("returns bytes for a Streamable per-video CDN subdomain", async () => {
    const router = makeRouter({
      fetchMediaBytes: async () => new ArrayBuffer(16),
    });
    const result = await router(
      {
        type: "slideshow.fetchMedia",
        payload: {
          url: "https://cdn-cf-east.streamable.com/video/mp4/abc123.mp4",
        },
      },
      OWN,
    );
    expect(result.ok).toBe(true);
  });

  it("returns bytes for a Giphy media subdomain", async () => {
    const router = makeRouter({
      fetchMediaBytes: async () => new ArrayBuffer(16),
    });
    const result = await router(
      {
        type: "slideshow.fetchMedia",
        payload: { url: "https://media2.giphy.com/media/abc/giphy.mp4" },
      },
      OWN,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a look-alike host that only ends with the brand, not the domain", async () => {
    let called = false;
    const router = makeRouter({
      fetchMediaBytes: async () => {
        called = true;
        return new ArrayBuffer(8);
      },
    });
    const result = await router(
      {
        type: "slideshow.fetchMedia",
        payload: { url: "https://evilstreamable.com/x.mp4" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: false });
    expect(called).toBe(false);
  });

  it("rejects a non-allowlisted media host without fetching", async () => {
    let called = false;
    const router = makeRouter({
      fetchMediaBytes: async () => {
        called = true;
        return new ArrayBuffer(8);
      },
    });
    const result = await router(
      {
        type: "slideshow.fetchMedia",
        payload: { url: "https://i.redd.it/a.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: false });
    expect(called).toBe(false);
  });

  it("fails closed when no media fetcher is wired", async () => {
    const router = makeRouter();
    const result = await router(
      {
        type: "slideshow.fetchMedia",
        payload: { url: "https://media.redgifs.com/X.mp4" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: false });
  });
});

describe("createMessageRouter - openOptions", () => {
  it("opens the options page for an own-sender request", async () => {
    const openOptionsPage = vi.fn();
    const router = makeRouter({ openOptionsPage });
    const result = await router({ type: "slideshow.openOptions" }, OWN);
    expect(openOptionsPage).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true });
  });

  it("ignores an openOptions request from a foreign sender", () => {
    const openOptionsPage = vi.fn();
    const router = makeRouter({ openOptionsPage });
    expect(
      router({ type: "slideshow.openOptions" }, { id: "someone-else" }),
    ).toBeUndefined();
    expect(openOptionsPage).not.toHaveBeenCalled();
  });
});

describe("createMessageRouter - openPopout", () => {
  const popoutMsg = (/** @type {string} */ url) => ({
    type: "slideshow.openPopout",
    payload: { url },
  });

  it("opens a popout for a Reddit URL from a content script", async () => {
    const openPopout = vi.fn();
    const router = makeRouter({ openPopout });
    const result = await router(
      popoutMsg("https://www.reddit.com/r/x/#rs-slideshow"),
      OWN,
    );
    expect(openPopout).toHaveBeenCalledWith(
      "https://www.reddit.com/r/x/#rs-slideshow",
    );
    expect(result).toEqual({ ok: true });
  });

  it("refuses a non-Reddit or non-HTTPS popout URL", async () => {
    const openPopout = vi.fn();
    const router = makeRouter({ openPopout });
    expect(await router(popoutMsg("https://evil.example/x"), OWN)).toEqual({
      ok: false,
    });
    expect(await router(popoutMsg("http://old.reddit.com/r/x/"), OWN)).toEqual({
      ok: false,
    });
    expect(openPopout).not.toHaveBeenCalled();
  });

  it("refuses a popout request from an extension page (no tab)", async () => {
    const openPopout = vi.fn();
    const router = makeRouter({ openPopout });
    const result = await router(popoutMsg("https://old.reddit.com/r/x/"), {
      id: RUNTIME_ID,
    });
    expect(result).toEqual({ ok: false });
    expect(openPopout).not.toHaveBeenCalled();
  });
});
