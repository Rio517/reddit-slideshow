import { describe, expect, it, vi } from "vitest";
import { createImageHasher } from "../../lib/image-hash.js";

/**
 * Build a 9x8 ImageData-like object whose per-pixel luminance is `value(x, y)`.
 * @param {(x: number, y: number) => number} value
 */
function imageData9x8(value) {
  const data = new Uint8ClampedArray(9 * 8 * 4);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 9; x += 1) {
      const i = (y * 9 + x) * 4;
      const v = value(x, y);
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width: 9, height: 8 };
}

describe("createImageHasher", () => {
  it("fetches the bytes, decodes, and returns the 16-char dHash hex", async () => {
    const fetchBytes = vi.fn(async () => new ArrayBuffer(4));
    // Strictly increasing left→right: every left>right comparison is false → all
    // 64 bits are 0 → 16 hex zeros.
    const decode = vi.fn(async () => imageData9x8((x) => x * 20));
    const hashImage = createImageHasher({ fetchBytes, decode });

    const hash = await hashImage("https://i.redd.it/x.png");

    expect(fetchBytes).toHaveBeenCalledWith("https://i.redd.it/x.png");
    expect(decode).toHaveBeenCalled();
    expect(hash).toBe("0000000000000000");
  });

  it("hashes a decreasing gradient to all ones", async () => {
    const hashImage = createImageHasher({
      fetchBytes: async () => new ArrayBuffer(4),
      decode: async () => imageData9x8((x) => (8 - x) * 20),
    });
    expect(await hashImage("u")).toBe("ffffffffffffffff");
  });

  it("returns null when the image can't be decoded", async () => {
    const hashImage = createImageHasher({
      fetchBytes: async () => new ArrayBuffer(4),
      decode: async () => null,
    });
    expect(await hashImage("u")).toBeNull();
  });
});
