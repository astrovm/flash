// A focused drop-down draws its text in the highlight color. The open list
// must not inherit it, or the options turn white on white.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../site/css/shell/controls.css", import.meta.url),
  "utf8",
);

const body = css.match(
  /(?:^|\n)\.xp-window select:not\(\[multiple\], \[size\]\) option \{([^}]*)\}/,
)?.[1];

test("drop-down options keep black text on white", () => {
  expect(body).toContain("color: #000;");
  expect(body).toContain("background: #fff;");
});

test("drop-down options use the field's 11px Tahoma", () => {
  expect(body?.replace(/\s+/g, " ")).toContain(
    'font: 11px Tahoma, "Segoe UI", sans-serif;',
  );
});
