// @ts-nocheck -- Application definitions accept loosely typed plugin metadata.
import { describe, expect, test } from "bun:test";

import { defineApplication } from "../site/apps/core/application.js";
import { defineLazyApplication } from "../site/apps/core/lazy-application.js";
import { createApplicationRegistry } from "../site/apps/core/registry.js";
import { validateBoxedWineApplications } from "../site/apps/core/boxedwine-applications.js";

const element = { nodeType: 1 };
const metadata = {
  id: "example",
  title: "Example",
  icon: "Example.png",
  kind: "program",
};

describe("application definitions", () => {
  test("require a mount function and non-empty text fields", () => {
    expect(() => defineApplication({ id: "example" })).toThrow(
      "Application example must define mount()",
    );
    expect(() => defineApplication({})).toThrow(
      "Application definition must define mount()",
    );
    expect(() =>
      defineApplication({
        ...metadata,
        title: " ",
        mount: () => ({ element }),
      }),
    ).toThrow("Application title must be a non-empty string");
  });

  test("normalize file types and supply a default unmount", () => {
    const application = defineApplication({
      ...metadata,
      fileTypes: [".TXT", ".txt"],
      mount: () => ({ element }),
    });
    expect(application.fileTypes).toEqual([".txt"]);
    expect(application.window).toEqual({ width: 640, height: 470 });
    const mounted = application.mount({}, {});
    expect(mounted.element).toBe(element);
    expect(mounted.unmount()).toBeUndefined();
    expect(() =>
      defineApplication({ ...metadata, mount: () => ({}) }).mount(),
    ).toThrow("mount() must return an element");
  });

  test("lazy applications refuse to mount before loading and retry failed loads", async () => {
    let attempts = 0;
    const lazy = defineLazyApplication(metadata, async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("network");
      return defineApplication({ ...metadata, mount: () => ({ element }) });
    });
    expect(() => lazy.mount()).toThrow("Example is still loading.");
    await expect(lazy.load()).rejects.toThrow("network");
    expect(lazy.loaded).toBeNull();
    await lazy.load();
    expect(lazy.mount().element).toBe(element);
    expect(attempts).toBe(2);
  });

  test("registries reject duplicate identifiers", () => {
    expect(() =>
      createApplicationRegistry([{ id: "same" }, { id: "same" }]),
    ).toThrow("Duplicate application id: same");
    expect(createApplicationRegistry([{ id: "one" }]).get("two")).toBeNull();
  });
});

describe("BoxedWine application catalog validation", () => {
  const valid = {
    id: "calculator",
    title: "Calculator",
    icon: "Calculator.png",
    executable: "calculator/calc.exe",
    packagePath: "site/iframe/calculator/xp-calculator.zip",
  };

  test.each([
    ["a non-array catalog", null, "must be an array"],
    ["a missing definition", [null], "Invalid BoxedWine application ID"],
    ["an invalid ID", [{ ...valid, id: "Bad ID" }], "application ID"],
    ["a duplicate ID", [valid, valid], "Duplicate BoxedWine application ID"],
    ["a blank title", [{ ...valid, title: "" }], "application title"],
    ["a non-PNG icon", [{ ...valid, icon: "icon.gif" }], "application icon"],
    [
      "an escaping executable",
      [{ ...valid, executable: "calculator/../calc.exe" }],
      "executable",
    ],
    [
      "a package outside the iframe folder",
      [{ ...valid, packagePath: "site/other/calc.zip" }],
      "package path",
    ],
  ])("rejects %s", (_label, definitions, message) => {
    expect(() => validateBoxedWineApplications(definitions)).toThrow(message);
  });
});
