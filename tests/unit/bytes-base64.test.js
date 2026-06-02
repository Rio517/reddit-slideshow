import { describe, expect, it } from "vitest";
import {
  arrayBufferToBase64,
  base64ToArrayBuffer,
} from "../../lib/bytes-base64.js";

describe("bytes-base64", () => {
  it("encodes to the known base64 of 'Man'", () => {
    const bytes = new Uint8Array([0x4d, 0x61, 0x6e]); // "Man"
    expect(arrayBufferToBase64(bytes.buffer)).toBe("TWFu");
  });

  it("round-trips arbitrary binary bytes", () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 128, 64, 32, 0]);
    const back = new Uint8Array(
      base64ToArrayBuffer(arrayBufferToBase64(original.buffer)),
    );
    expect(Array.from(back)).toEqual(Array.from(original));
  });

  it("round-trips a large buffer without overflowing the call stack", () => {
    const big = new Uint8Array(200_000);
    for (let i = 0; i < big.length; i += 1) big[i] = i % 256;
    const back = new Uint8Array(
      base64ToArrayBuffer(arrayBufferToBase64(big.buffer)),
    );
    expect(back.length).toBe(big.length);
    expect(back[12345]).toBe(12345 % 256);
  });
});
