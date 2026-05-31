import { describe, expect, it, vi } from "vitest";
import { createMessageRouter } from "../../lib/background-router.js";

const RUNTIME_ID = "self@example";
const OWN = { id: RUNTIME_ID };

function makeRouter(overrides = {}) {
  return createMessageRouter({
    runtimeId: RUNTIME_ID,
    fetchQueuePage: async () => ({
      slides: [{ id: "a" }],
      after: "t3_x",
      before: null,
      postsScanned: 50,
      exhausted: false,
    }),
    fetchImageBytes: async () => new ArrayBuffer(8),
    ...overrides,
  });
}

describe("createMessageRouter — sender validation", () => {
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

describe("createMessageRouter — requestPage", () => {
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
});

describe("createMessageRouter — fetchImage", () => {
  it("returns bytes for a valid url", async () => {
    const router = makeRouter();
    const result = await router(
      {
        type: "slideshow.fetchImage",
        payload: { url: "https://i.redd.it/a.jpg" },
      },
      OWN,
    );
    expect(result.ok).toBe(true);
    expect(result.bytes).toBeInstanceOf(ArrayBuffer);
  });

  it("fails closed when the fetch rejects", async () => {
    const router = makeRouter({
      fetchImageBytes: async () => {
        throw new Error("blocked");
      },
    });
    const result = await router(
      {
        type: "slideshow.fetchImage",
        payload: { url: "https://i.redd.it/a.jpg" },
      },
      OWN,
    );
    expect(result).toEqual({ ok: false });
  });

  it("rejects a non-Reddit-image host without fetching", async () => {
    let called = false;
    const router = makeRouter({
      fetchImageBytes: async () => {
        called = true;
        return new ArrayBuffer(8);
      },
    });
    const result = await router(
      {
        type: "slideshow.fetchImage",
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
      fetchImageBytes: async () => {
        called = true;
        return new ArrayBuffer(8);
      },
    });
    const result = await router(
      {
        type: "slideshow.fetchImage",
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
      await router({ type: "slideshow.fetchImage", payload: {} }, OWN),
    ).toEqual({ ok: false });
  });
});

describe("createMessageRouter — openOptions", () => {
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
