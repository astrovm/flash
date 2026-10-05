// cards.dll's faces, shared by the card games. A card is rank * 4 + suit,
// with suits in cards.dll's order: clubs, diamonds, hearts, spades.
export const CARD_WIDTH = 71;
export const CARD_HEIGHT = 96;

// Listed in full so the build can fingerprint each file. cards.dll numbers
// its faces by suit, then rank.
const FACE_URLS = [
  "assets/xp/cards/faces/1.png",
  "assets/xp/cards/faces/2.png",
  "assets/xp/cards/faces/3.png",
  "assets/xp/cards/faces/4.png",
  "assets/xp/cards/faces/5.png",
  "assets/xp/cards/faces/6.png",
  "assets/xp/cards/faces/7.png",
  "assets/xp/cards/faces/8.png",
  "assets/xp/cards/faces/9.png",
  "assets/xp/cards/faces/10.png",
  "assets/xp/cards/faces/11.png",
  "assets/xp/cards/faces/12.png",
  "assets/xp/cards/faces/13.png",
  "assets/xp/cards/faces/14.png",
  "assets/xp/cards/faces/15.png",
  "assets/xp/cards/faces/16.png",
  "assets/xp/cards/faces/17.png",
  "assets/xp/cards/faces/18.png",
  "assets/xp/cards/faces/19.png",
  "assets/xp/cards/faces/20.png",
  "assets/xp/cards/faces/21.png",
  "assets/xp/cards/faces/22.png",
  "assets/xp/cards/faces/23.png",
  "assets/xp/cards/faces/24.png",
  "assets/xp/cards/faces/25.png",
  "assets/xp/cards/faces/26.png",
  "assets/xp/cards/faces/27.png",
  "assets/xp/cards/faces/28.png",
  "assets/xp/cards/faces/29.png",
  "assets/xp/cards/faces/30.png",
  "assets/xp/cards/faces/31.png",
  "assets/xp/cards/faces/32.png",
  "assets/xp/cards/faces/33.png",
  "assets/xp/cards/faces/34.png",
  "assets/xp/cards/faces/35.png",
  "assets/xp/cards/faces/36.png",
  "assets/xp/cards/faces/37.png",
  "assets/xp/cards/faces/38.png",
  "assets/xp/cards/faces/39.png",
  "assets/xp/cards/faces/40.png",
  "assets/xp/cards/faces/41.png",
  "assets/xp/cards/faces/42.png",
  "assets/xp/cards/faces/43.png",
  "assets/xp/cards/faces/44.png",
  "assets/xp/cards/faces/45.png",
  "assets/xp/cards/faces/46.png",
  "assets/xp/cards/faces/47.png",
  "assets/xp/cards/faces/48.png",
  "assets/xp/cards/faces/49.png",
  "assets/xp/cards/faces/50.png",
  "assets/xp/cards/faces/51.png",
  "assets/xp/cards/faces/52.png",
];

export const faceUrl = (card) =>
  FACE_URLS[(card % 4) * 13 + Math.floor(card / 4)];

// cards.dll rounds each corner by leaving three pixels unpainted.
const CORNERS = [
  [0, 0],
  [1, 0],
  [0, 1],
];
const isCorner = (x, y) =>
  CORNERS.some(
    ([cornerX, cornerY]) =>
      (x === cornerX || x === CARD_WIDTH - 1 - cornerX) &&
      (y === cornerY || y === CARD_HEIGHT - 1 - cornerY),
  );

// cards.dll draws every card's outline in black, over the red outline of
// the hearts and diamonds bitmaps.
const isOutline = (x, y) => {
  const right = CARD_WIDTH - 1;
  const bottom = CARD_HEIGHT - 1;
  if ((y === 0 || y === bottom) && x >= 2 && x <= right - 2) return true;
  if ((x === 0 || x === right) && y >= 2 && y <= bottom - 2) return true;
  return (x === 1 || x === right - 1) && (y === 1 || y === bottom - 1);
};

// A selected card draws inverted. The two-color clubs and spades from ace
// to ten invert to cyan with white pips, as XP draws them.
const isMonochromeBlack = (card) =>
  (card % 4 === 0 || card % 4 === 3) && Math.floor(card / 4) < 10;

const renderFace = (image, card, inverted) => {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, CARD_WIDTH, CARD_HEIGHT);
  const { data } = pixels;
  for (let y = 0; y < CARD_HEIGHT; y += 1)
    for (let x = 0; x < CARD_WIDTH; x += 1) {
      const offset = (y * CARD_WIDTH + x) * 4;
      if (isCorner(x, y)) {
        data[offset + 3] = 0;
        continue;
      }
      if (isOutline(x, y)) data.fill(0, offset, offset + 3);
      if (!inverted) continue;
      if (isMonochromeBlack(card) && data[offset] === 255) {
        data[offset] = 0;
        continue;
      }
      for (let channel = 0; channel < 3; channel += 1)
        data[offset + channel] = 255 - data[offset + channel];
    }
  context.putImageData(pixels, 0, 0);
  return canvas;
};

// Loads the faces once. Each card keeps a normal and an inverted rendering.
let facesPromise = null;
export const loadCardFaces = () => {
  facesPromise ??= Promise.all(
    Array.from(
      { length: 52 },
      (_, card) =>
        new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () =>
            resolve({
              normal: renderFace(image, card, false),
              inverted: renderFace(image, card, true),
            });
          image.onerror = () => reject(new Error("The cards didn't load."));
          image.src = faceUrl(card);
        }),
    ),
  ).catch((error) => {
    facesPromise = null;
    throw error;
  });
  return facesPromise;
};
