import { describe, expect, it, vi } from "vitest";
import { createVoter } from "../../lib/reddit-vote.js";

/** @param {any} body @param {{ status?: number }} [opts] */
function jsonResponse(body, { status = 200 } = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("createVoter", () => {
  it("fetches the modhash once and posts id/dir/uh, caching the token", async () => {
    /** @type {Array<{ url: string, opts: any }>} */
    const calls = [];
    const fetchImpl = vi.fn(
      async (/** @type {any} */ url, /** @type {any} */ opts) => {
        calls.push({ url: String(url), opts });
        return String(url).includes("/api/me.json")
          ? jsonResponse({ data: { modhash: "MH" } })
          : jsonResponse({});
      },
    );
    const { vote } = createVoter({ fetchImpl: /** @type {any} */ (fetchImpl) });

    expect(await vote("t3_abc", 1)).toBe(true);
    await vote("t3_def", -1);

    const me = calls.filter((c) => c.url.includes("/api/me.json"));
    expect(me.length).toBe(1); // modhash reused
    const firstVote = calls.find((c) => c.url.includes("/api/vote"));
    expect(firstVote?.opts?.method).toBe("POST");
    expect(firstVote?.opts?.credentials).toBe("include");
    const params = new URLSearchParams(firstVote?.opts?.body);
    expect(params.get("id")).toBe("t3_abc");
    expect(params.get("dir")).toBe("1");
    expect(params.get("uh")).toBe("MH");
  });

  it("refreshes the modhash once on a 403 and retries the vote", async () => {
    let voteCalls = 0;
    const fetchImpl = vi.fn(async (/** @type {any} */ url) => {
      if (String(url).includes("/api/me.json"))
        return jsonResponse({ data: { modhash: "MH" } });
      voteCalls += 1;
      return voteCalls === 1
        ? jsonResponse({}, { status: 403 })
        : jsonResponse({});
    });
    const { vote } = createVoter({ fetchImpl: /** @type {any} */ (fetchImpl) });
    expect(await vote("t3_abc", 0)).toBe(true);
    expect(voteCalls).toBe(2);
  });

  it("throws when the session has no modhash (not logged in)", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ data: { modhash: "" } }),
    );
    const { vote } = createVoter({ fetchImpl: /** @type {any} */ (fetchImpl) });
    await expect(vote("t3_abc", 1)).rejects.toThrow();
  });

  it("throws on a failed vote response", async () => {
    const fetchImpl = vi.fn(async (/** @type {any} */ url) =>
      String(url).includes("/api/me.json")
        ? jsonResponse({ data: { modhash: "MH" } })
        : jsonResponse({}, { status: 500 }),
    );
    const { vote } = createVoter({ fetchImpl: /** @type {any} */ (fetchImpl) });
    await expect(vote("t3_abc", 1)).rejects.toThrow();
  });
});
