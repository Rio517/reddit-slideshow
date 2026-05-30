import { afterEach, describe, expect, it } from "vitest";
import { listingPostElements, postFullname } from "../../lib/reddit-dom.js";

afterEach(() => {
  document.body.innerHTML = "";
});

const fullnames = (/** @type {Document} */ doc) =>
  listingPostElements(doc).map(postFullname);

describe("listingPostElements + postFullname", () => {
  it("reads old Reddit thing fullnames in order, excluding promoted", () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_a"></div>
      <div class="thing self promoted" data-fullname="t3_ad"></div>
      <div class="thing link" data-fullname="t3_b"></div>`;
    expect(fullnames(document)).toEqual(["t3_a", "t3_b"]);
  });

  it("reads new Reddit shreddit-post fullnames from the element id", () => {
    document.body.innerHTML = `
      <shreddit-post id="t3_a" permalink="/r/x/comments/a/"></shreddit-post>
      <shreddit-post id="t3_b" permalink="/r/x/comments/b/"></shreddit-post>`;
    expect(fullnames(document)).toEqual(["t3_a", "t3_b"]);
  });

  it("excludes new Reddit ads (shreddit-ad-post and promoted shreddit-post)", () => {
    // Ads render as a distinct shreddit-ad-post element; the :not([promoted])
    // guard also drops any shreddit-post that is ever marked promoted.
    document.body.innerHTML = `
      <shreddit-post id="t3_a"></shreddit-post>
      <shreddit-ad-post id="t3_ad1" promoted></shreddit-ad-post>
      <shreddit-post id="t3_ad2" promoted></shreddit-post>
      <shreddit-post id="t3_b"></shreddit-post>`;
    expect(fullnames(document)).toEqual(["t3_a", "t3_b"]);
  });

  it("prefers old Reddit posts when both exist (old-Reddit page)", () => {
    document.body.innerHTML = `
      <div class="thing link" data-fullname="t3_old"></div>
      <shreddit-post id="t3_new"></shreddit-post>`;
    expect(fullnames(document)).toEqual(["t3_old"]);
  });

  it("returns no elements when there are no posts", () => {
    document.body.innerHTML = `<div>nothing</div>`;
    expect(listingPostElements(document)).toEqual([]);
  });
});
