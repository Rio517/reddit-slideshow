import { describe, expect, it } from "vitest";
import {
  fetchListingJson,
  summarizeListing,
} from "../../lib/reddit-listing.js";
import fixture from "../fixtures/reddit-json/subreddit-direct-images.json";

describe("fetchListingJson", () => {
  it("fetches the normalized listing JSON with credentials included", async () => {
    /** @type {Array<[string, RequestInit]>} */
    const calls = [];
    /** @type {typeof fetch} */
    const fetchImpl = async (url, init) => {
      calls.push([String(url), init ?? {}]);
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "x-ratelimit-remaining": "99",
        },
      });
    };

    const result = await fetchListingJson(
      "https://old.reddit.com/r/example/",
      {},
      fetchImpl,
    );

    expect(calls).toEqual([
      [
        "https://old.reddit.com/r/example/.json?raw_json=1",
        {
          credentials: "include",
          headers: { accept: "application/json" },
        },
      ],
    ]);
    expect(result.listing).toEqual(fixture);
    expect(result.summary).toMatchObject({
      jsonUrl: "https://old.reddit.com/r/example/.json?raw_json=1",
      status: 200,
      ok: true,
      childCount: 2,
      after: "t3_beta",
      rateLimitRemaining: "99",
    });
  });

  it("throws a typed error for non-ok responses", async () => {
    const fetchImpl = async () =>
      new Response("Forbidden", { status: 403, statusText: "Forbidden" });

    await expect(
      fetchListingJson("https://old.reddit.com/r/example/", {}, fetchImpl),
    ).rejects.toMatchObject({
      name: "RedditListingFetchError",
      status: 403,
      jsonUrl: "https://old.reddit.com/r/example/.json?raw_json=1",
    });
  });

  it("fails closed when a 200 response is not JSON", async () => {
    const fetchImpl = async () =>
      new Response("<!doctype html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      });

    await expect(
      fetchListingJson("https://old.reddit.com/r/example/", {}, fetchImpl),
    ).rejects.toMatchObject({ name: "RedditListingFetchError", status: 200 });
  });
});

describe("summarizeListing", () => {
  it("summarizes listing shape for diagnostics", () => {
    expect(
      summarizeListing(fixture, "https://old.reddit.com/r/example/.json"),
    ).toEqual({
      jsonUrl: "https://old.reddit.com/r/example/.json",
      childCount: 2,
      after: "t3_beta",
    });
  });
});
