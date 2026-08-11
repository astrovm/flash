import { describe, expect, test } from "bun:test";
import { encodeBmp, extensionFor } from "../site/apps/paint/file-formats.js";
import { createPaintHistory } from "../site/apps/paint/history.js";

describe("native Paint image formats", () => {
  test("encodes a valid bottom-up 24-bit BMP", () => {
    const bmp = encodeBmp({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]),
    });
    const header = new DataView(bmp.buffer);
    expect(String.fromCharCode(bmp[0], bmp[1])).toBe("BM");
    expect(header.getUint32(2, true)).toBe(62);
    expect(header.getInt32(18, true)).toBe(2);
    expect(header.getInt32(22, true)).toBe(1);
    expect(header.getUint16(28, true)).toBe(24);
    expect([...bmp.slice(54, 60)]).toEqual([0, 0, 255, 0, 255, 0]);
  });

  test("uses BMP when a filename has no extension", () => {
    expect(extensionFor("untitled")).toBe("bmp");
    expect(extensionFor("photo.JPEG")).toBe("jpeg");
  });
});

describe("native Paint history", () => {
  test("undo and repeat restore actual canvas states", () => {
    const history = createPaintHistory(3);
    history.capture(1);
    history.capture(2);
    expect(history.undo(3)).toBe(2);
    expect(history.undo(2)).toBe(1);
    expect(history.redo(1)).toBe(2);
  });

  test("keeps the three undo levels supported by XP Paint", () => {
    const history = createPaintHistory(3);
    for (const state of [1, 2, 3, 4]) history.capture(state);
    expect(history.undo(5)).toBe(4);
    expect(history.undo(4)).toBe(3);
    expect(history.undo(3)).toBe(2);
    expect(history.undo(2)).toBeNull();
  });

  test("opening or creating a picture resets the previous undo history", () => {
    const history = createPaintHistory(3);
    history.capture(1);
    history.clear();
    expect(history.undo(2)).toBeNull();
    expect(history.redo(2)).toBeNull();
  });
});
