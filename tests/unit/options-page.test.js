import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const html = readFileSync(
  resolve(process.cwd(), "entrypoints/options/index.html"),
  "utf8",
);

const doc = new DOMParser().parseFromString(html, "text/html");

describe("options page footer", () => {
  it("links to the GitHub Sponsors page", () => {
    const link = doc.querySelector(
      'a[href="https://github.com/sponsors/Rio517"]',
    );
    expect(link).not.toBeNull();
  });

  it("opens the Sponsors link as a safe external link", () => {
    const link = doc.querySelector(
      'a[href="https://github.com/sponsors/Rio517"]',
    );
    expect(link?.getAttribute("target")).toBe("_blank");
    // noopener so the external tab can't reach window.opener.
    expect(link?.getAttribute("rel") ?? "").toContain("noopener");
  });
});
