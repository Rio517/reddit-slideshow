import { describe, expect, it } from "vitest";
import { toListingJsonUrl } from "../../lib/reddit-url.js";

describe("toListingJsonUrl", () => {
  it("converts an old Reddit subreddit URL to JSON", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/")).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1",
    );
  });

  it("preserves sort path and query parameters", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/top/?t=week")).toBe(
      "https://old.reddit.com/r/pics/top/.json?t=week&raw_json=1",
    );
  });

  it("adds after pagination when provided", () => {
    expect(
      toListingJsonUrl("https://old.reddit.com/r/pics/", { after: "t3_alpha" }),
    ).toBe("https://old.reddit.com/r/pics/.json?raw_json=1&after=t3_alpha");
  });

  it("handles a URL with no trailing slash", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics")).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1",
    );
  });

  it("is idempotent for an already-.json URL", () => {
    expect(toListingJsonUrl("https://old.reddit.com/r/pics/.json")).toBe(
      "https://old.reddit.com/r/pics/.json?raw_json=1",
    );
  });

  it("rejects comment permalinks because they are not a listing shape", () => {
    expect(() =>
      toListingJsonUrl("https://old.reddit.com/r/pics/comments/abc/title/"),
    ).toThrow("Unsupported Reddit listing URL");
  });

  it("rejects non-Reddit URLs", () => {
    expect(() => toListingJsonUrl("https://example.com/r/pics/")).toThrow(
      "Unsupported Reddit listing URL",
    );
  });

  it("converts a www.reddit.com listing URL to JSON on the same host", () => {
    expect(toListingJsonUrl("https://www.reddit.com/r/pics/")).toBe(
      "https://www.reddit.com/r/pics/.json?raw_json=1",
    );
  });

  it("preserves the host (no old/new cross-mapping)", () => {
    expect(toListingJsonUrl("https://www.reddit.com/r/pics/top/?t=week")).toBe(
      "https://www.reddit.com/r/pics/top/.json?t=week&raw_json=1",
    );
  });
});
