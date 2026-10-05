// XP's System font, the bold raster font a window's DC draws with by
// default. vgasys.fon holds it as a Windows 2.0 font resource.
const FONT_URL = "assets/xp/fonts/System.fnt";

// Reads the glyphs: a table of widths and offsets after the 118-byte
// header, each glyph stored in 8-pixel-wide byte columns.
export const parseFont = (buffer) => {
  const view = new DataView(buffer);
  const height = view.getUint16(0x58, true);
  const ascent = view.getUint16(0x4a, true);
  const first = view.getUint8(0x5f);
  const last = view.getUint8(0x60);
  const glyphs = new Map();
  for (let code = first; code <= last; code += 1) {
    const entry = 118 + (code - first) * 4;
    const width = view.getUint16(entry, true);
    const offset = view.getUint16(entry + 2, true);
    const pixels = [];
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        const byte = view.getUint8(offset + (x >> 3) * height + y);
        if (byte & (0x80 >> (x & 7))) pixels.push([x, y]);
      }
    glyphs.set(code, { width, pixels });
  }
  return { height, ascent, glyphs };
};

let fontPromise = null;
export const loadSystemFont = () => {
  fontPromise ??= fetch(FONT_URL)
    .then((response) => {
      if (!response.ok) throw new Error("The System font didn't load.");
      return response.arrayBuffer();
    })
    .then(parseFont)
    .catch((error) => {
      fontPromise = null;
      throw error;
    });
  return fontPromise;
};

// Spider draws only plain ASCII, which the font covers.
const glyphFor = (font, character) => font.glyphs.get(character.charCodeAt(0));

export const measureText = (font, text) =>
  [...text].reduce(
    (width, character) => width + glyphFor(font, character).width,
    0,
  );

// Draws text with its cell's top-left corner at (x, y), pixel by pixel.
export const drawText = (graphics, font, text, x, y, color) => {
  graphics.fillStyle = color;
  let left = x;
  for (const character of text) {
    const glyph = glyphFor(font, character);
    for (const [pixelX, pixelY] of glyph.pixels)
      graphics.fillRect(left + pixelX, y + pixelY, 1, 1);
    left += glyph.width;
  }
};
