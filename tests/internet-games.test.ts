// @ts-nocheck -- The real shell UI talks to an in-memory game-library service.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  flushShell,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
async function setup({ broken = false } = {}) {
  let notify,
    results = [],
    searchFailure,
    installFailure,
    uninstallFailure;
  const installed = {},
    records = new Map(),
    calls = [];
  const manager = {
    subscribe: (fn) => {
      notify = fn;
      return () => {};
    },
    initialize: async () => {
      if (broken) throw new Error("library unavailable");
      return installed;
    },
    search: async (term) => {
      calls.push(["search", term]);
      if (searchFailure) throw new Error(searchFailure);
      return results;
    },
    details: async (uuid) => results.find((g) => g.uuid === uuid),
    install: async (details, { onProgress }) => {
      onProgress({ loaded: 30, total: 100 });
      onProgress({ loaded: 30, total: 0 });
      if (installFailure) throw new Error(installFailure);
      const id = `flashpoint:${details.uuid}`;
      records.set(id, details);
      installed[id] = {
        ...details,
        installed: true,
        type: "iframe",
        url: "https://flash.example/game/",
      };
      notify({ ...installed });
    },
    getRecord: (id) => records.get(id),
    uninstall: async (uuid) => {
      if (uninstallFailure) throw new Error(uninstallFailure);
      delete installed[`flashpoint:${uuid}`];
      records.delete(`flashpoint:${uuid}`);
      notify({ ...installed });
    },
  };
  const s = await login(await loadShell({ gameLibraryManager: manager }));
  s.document
    .querySelector('[data-desktop-id="__internet-games"]')
    .dispatchEvent(new s.window.MouseEvent("dblclick", { bubbles: true }));
  const win = s.document.querySelector(
    '.xp-window[data-game="__internet-games"]',
  );
  const search = async (term) => {
    win.querySelector("#internet-games-query").value = term;
    win
      .querySelector("form")
      .dispatchEvent(
        new s.window.Event("submit", { bubbles: true, cancelable: true }),
      );
    await flushShell();
  };
  const answer = async (text) => {
    [...s.document.querySelectorAll(".xp-dialog .dlg-buttons button")]
      .find((b) => b.textContent === text)
      .click();
    await flushShell();
    await flushShell();
  };
  return {
    s,
    win,
    search,
    answer,
    calls,
    setResults: (v) => {
      results = v;
    },
    failSearch: (v) => {
      searchFailure = v;
    },
    failInstall: (v) => {
      installFailure = v;
    },
    failUninstall: (v) => {
      uninstallFailure = v;
    },
  };
}
test("Internet Games search handles empty results, service errors, compatibility and missing artwork", async () => {
  const h = await setup(),
    status = h.win.querySelector(".internet-games-status");
  await h.search("");
  expect(status.textContent).toBe("Enter a game title.");
  await h.search("nothing");
  expect(status.textContent).toBe("No games found.");
  h.failSearch("catalog offline");
  await h.search("game");
  expect(status.textContent).toBe("catalog offline");
  h.failSearch(null);
  h.setResults([
    {
      uuid: "one",
      title: "Custom Game",
      tags: ["Puzzle"],
      compatible: false,
      incompatibleReason: "Unsupported engine",
    },
    { uuid: "two", title: "Blocked", potentiallyCompatible: false },
    { uuid: "three", title: "Big Truck Adventures", developer: "Author" },
  ]);
  await h.search("test");
  expect(status.textContent).toBe("3 results found.");
  const cards = [
    ...h.win.querySelectorAll(".internet-games-results .internet-game-card"),
  ];
  cards[0].querySelector("img").dispatchEvent(new h.s.window.Event("error"));
  expect(cards[0].querySelector("img").hidden).toBeTrue();
  expect(cards[1].querySelector("button").disabled).toBeTrue();
  expect(cards[2].querySelector("button").textContent).toBe("Play");
  cards[0].querySelector("button").click();
  await flushShell();
  expect(status.textContent).toBe("Unsupported engine");
});
test("Internet Games installs, opens and uninstalls a game with retryable failures", async () => {
  const h = await setup(),
    status = h.win.querySelector(".internet-games-status");
  h.setResults([
    {
      uuid: "one",
      title: "Custom Game",
      type: "iframe",
      compatible: true,
      icon: "assets/icons/freecell.png",
      tags: [],
    },
  ]);
  await h.search("custom");
  const install = h.win.querySelector(".internet-games-results button");
  h.failInstall("disk full");
  install.click();
  await flushShell();
  expect(status.textContent).toBe("disk full");
  expect(install.disabled).toBeFalse();
  h.failInstall(null);
  install.click();
  await flushShell();
  await flushShell();
  expect(install.textContent).toBe("Play");
  expect(status.textContent).toContain("installed successfully");
  const tab = h.win.querySelector('[data-internet-tab="installed"]');
  tab.click();
  expect(
    h.win.querySelector(".internet-games-installed-status").textContent,
  ).toBe("1 installed game.");
  h.win.querySelector(".internet-games-installed button").click();
  await flushShell();
  expect(
    !!h.s.document.querySelector(
      '.xp-window[data-game="flashpoint:one"] iframe',
    ),
  ).toBeTrue();
  const remove = () =>
    [...h.win.querySelectorAll(".internet-games-installed button")].find(
      (b) => b.textContent === "Uninstall",
    );
  remove().click();
  await h.answer("No");
  expect(!!remove()).toBeTrue();
  h.failUninstall("remove failed");
  remove().click();
  await h.answer("Yes");
  expect(h.s.document.querySelector(".xp-dialog").textContent).toContain(
    "remove failed",
  );
  await h.answer("OK");
  expect(remove().disabled).toBeFalse();
  h.failUninstall(null);
  remove().click();
  await h.answer("Yes");
  expect(
    h.win.querySelector(".internet-games-installed-status").textContent,
  ).toContain("No internet games");
  expect(
    h.s.document.querySelector('.xp-window[data-game="flashpoint:one"]') ===
      null,
  ).toBeTrue();
  for (const key of ["ArrowLeft", "ArrowRight"])
    tab.dispatchEvent(
      new h.s.window.KeyboardEvent("keydown", { key, bubbles: true }),
    );
  expect(
    h.win
      .querySelector('[data-internet-tab="browse"]')
      .getAttribute("aria-selected"),
  ).toBe("true");
});
test("Internet Games reports initialization failures without submitting a search", async () => {
  const h = await setup({ broken: true });
  await h.search("anything");
  expect(h.win.querySelector(".internet-games-status").textContent).toBe(
    "library unavailable",
  );
  expect(h.calls).toEqual([]);
});
