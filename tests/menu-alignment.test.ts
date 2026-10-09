// Checkable menu items must start their label at the same x as plain items.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(
  new URL("../site/css/shell/windows.css", import.meta.url),
  "utf8",
);

const rule = (selector: string) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const body = css.match(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`))?.[1];
  if (!body) throw new Error(`Missing rule ${selector}`);
  const px = (property: string) => {
    const value = body.match(new RegExp(`(?:^|\\s)${property}: (-?\\d+)px;`));
    if (!value) throw new Error(`${selector} has no ${property}`);
    return Number(value[1]);
  };
  return px;
};

test.each([".menu-check", ".explorer-menu .menu-check"])(
  "%s pulls back exactly the space it takes",
  (selector) => {
    const px = rule(selector);
    expect(px("width") + px("margin-left")).toBe(0);
  },
);
