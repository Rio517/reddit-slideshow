import { afterEach, describe, expect, it } from "vitest";
import { listingPostFullnames } from "../../lib/reddit-dom.js";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("listingPostFullnames", () => {
  it("reads old Reddit thing fullnames in order, excluding promoted", () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_a"></div>
      <div class="thing self promoted" data-fullname="t3_ad"></div>
      <div class="thing link" data-fullname="t3_b"></div>`;
    expect(listingPostFullnames(document)).toEqual(["t3_a", "t3_b"]);
  });

  it("reads new Reddit shreddit-post fullnames from the element id", () => {
    document.body.innerHTML = `
      <shreddit-post id="t3_a" permalink="/r/x/comments/a/"></shreddit-post>
      <shreddit-post id="t3_b" permalink="/r/x/comments/b/"></shreddit-post>`;
    expect(listingPostFullnames(document)).toEqual(["t3_a", "t3_b"]);
  });

  it("prefers old Reddit posts when both exist (old-Reddit page)", () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_old"></div>
      <shreddit-post id="t3_new"></shreddit-post>`;
    expect(listingPostFullnames(document)).toEqual(["t3_old"]);
  });

  it("returns an empty array when there are no posts", () => {
    document.body.innerHTML = `<div>nothing</div>`;
    expect(listingPostFullnames(document)).toEqual([]);
  });
});
