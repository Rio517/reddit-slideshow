import { describe, expect, it } from "vitest";
import { afterCursorForViewport } from "../../lib/page-cursor.js";

describe("afterCursorForViewport", () => {
  it("returns undefined with no posts", () => {
    expect(afterCursorForViewport([])).toBeUndefined();
  });

  it("starts from the top when the first post is visible", () => {
    expect(
      afterCursorForViewport([
        { fullname: "t3_a", bottom: 200 },
        { fullname: "t3_b", bottom: 600 },
      ]),
    ).toBeUndefined();
  });

  it("uses the post above the viewport top as the after cursor", () => {
    expect(
      afterCursorForViewport([
        { fullname: "t3_a", bottom: -400 },
        { fullname: "t3_b", bottom: -50 },
        { fullname: "t3_c", bottom: 300 },
      ]),
    ).toBe("t3_b");
  });

  it("starts after the last post when everything is scrolled past", () => {
    expect(
      afterCursorForViewport([
        { fullname: "t3_a", bottom: -800 },
        { fullname: "t3_b", bottom: -400 },
      ]),
    ).toBe("t3_b");
  });
});
