import { describe, expect, it } from "vitest";
import {
  DIRECT_VIDEO_HOSTS,
  PROXY_MEDIA_HOST_SUFFIXES,
  hostMatches,
  isStreamableHost,
} from "../../lib/provider-hosts.js";

describe("hostMatches", () => {
  it("matches an exact host", () => {
    expect(hostMatches("v.redd.it", { hosts: DIRECT_VIDEO_HOSTS })).toBe(true);
    expect(hostMatches("evil.example", { hosts: DIRECT_VIDEO_HOSTS })).toBe(
      false,
    );
  });

  it("matches a dot-prefixed suffix but not a bare look-alike", () => {
    expect(
      hostMatches("cdn-x.streamable.com", {
        suffixes: PROXY_MEDIA_HOST_SUFFIXES,
      }),
    ).toBe(true);
    // No leading dot -> a look-alike domain must not match the suffix.
    expect(
      hostMatches("evilstreamable.com", {
        suffixes: PROXY_MEDIA_HOST_SUFFIXES,
      }),
    ).toBe(false);
  });

  it("returns false with no allowlist", () => {
    expect(hostMatches("anything.com", {})).toBe(false);
  });
});

describe("isStreamableHost", () => {
  it("accepts the watch domain and CDN subdomains", () => {
    expect(isStreamableHost("streamable.com")).toBe(true);
    expect(isStreamableHost("cdn-cf-east.streamable.com")).toBe(true);
  });

  it("rejects look-alikes and undefined", () => {
    expect(isStreamableHost("evilstreamable.com")).toBe(false);
    expect(isStreamableHost(undefined)).toBe(false);
  });
});
