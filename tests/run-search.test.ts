// @ts-nocheck -- Exercise the real Run and Search UI with browser fixtures.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  loadShell,
  login,
  flushShell,
  clickStartAction,
} from "./helpers/shell-harness";
afterEach(cleanupShells);
const run = async (s, command) => {
  clickStartAction(s, "run");
  const dialog = s.document.querySelector(".run-dialog");
  dialog.querySelector("#run-command").value = command;
  dialog.querySelector('[data-action="run"]').click();
  await flushShell();
};
test("Run opens shell applications and keeps case-insensitive recent history", async () => {
  const s = await login(
    await loadShell({
      initialStorage: { runHistory: '["DOCUMENTS","pictures"]' },
    }),
  );
  for (const [command, id] of [
    ["documents", "__my-documents"],
    ["pictures", "__my-pictures"],
    ["music", "__my-music"],
    ["computer", "__my-computer"],
    ["control panel", "__control-panel"],
    ["search", "__search"],
    ["internet games", "__internet-games"],
  ]) {
    await run(s, command);
    expect(
      s.document.querySelector(`.xp-window[data-game="${id}"]`),
    ).not.toBeNull();
  }
  await run(s, "Documents");
  const history = JSON.parse(s.window.localStorage.getItem("runHistory"));
  expect(history[0]).toBe("Documents");
  expect(
    history.filter((entry) => entry.toLowerCase() === "documents"),
  ).toHaveLength(1);
  clickStartAction(s, "run");
  expect(
    s.document.querySelectorAll("#run-command-history option").length,
  ).toBe(history.length);
  s.document.querySelector('.run-dialog [data-action="cancel"]').click();
});
test("Run resolves filesystem paths and reports unknown commands without recording them", async () => {
  const s = await login(
    await loadShell({ initialStorage: { runHistory: "[17]" } }),
  );
  const fs = s.window.VirtualFS;
  const folder = fs.createFolder(fs.MY_DOCUMENTS, "Run Fixture");
  await run(s, fs.getPath(folder.id));
  expect(
    s.document.querySelector(
      '.xp-window[data-game="__my-documents"] .explorer-address input',
    ).value,
  ).toBe(fs.getPath(folder.id));
  await run(s, "unknown synthetic program");
  expect(s.document.querySelectorAll(".xp-dialog").length).toBe(2);
  expect(s.document.body.textContent).toContain(
    'Windows cannot find "unknown synthetic program"',
  );
  expect(JSON.parse(s.window.localStorage.getItem("runHistory"))).toEqual([
    fs.getPath(folder.id),
  ]);
});
test("Search filters by type and location and opens selected results with Enter", async () => {
  const s = await login(await loadShell());
  const fs = s.window.VirtualFS;
  const folder = fs.createFolder(fs.MY_DOCUMENTS, "Search Fixture");
  fs.createFile(folder.id, "matching.txt", { content: "searched" });
  clickStartAction(s, "search");
  const win = s.document.querySelector('.xp-window[data-game="__search"]');
  win.querySelector("[data-search-kind]").click();
  const query = win.querySelector("#search-filename");
  const type = win.querySelector("#search-type");
  const location = win.querySelector("#search-location");
  const search = async (text, kind = "all") => {
    query.value = text;
    type.value = kind;
    query.dispatchEvent(
      new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    await flushShell();
    return [...win.querySelectorAll(".search-result")];
  };
  await search("Search Fixture", "folders");
  let result = win.querySelector(".search-results-list").firstElementChild;
  expect(result.textContent).toContain("Search Fixture");
  result.click();
  expect(result.classList.contains("selected")).toBeTrue();
  result.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
  );
  await flushShell();
  expect(
    s.document.querySelector(
      '.xp-window[data-game="__my-documents"] .explorer-address input',
    ).value,
  ).toBe(fs.getPath(folder.id));
  location.value = fs.MY_DOCUMENTS;
  await search("matching", "files");
  expect(win.querySelector(".search-results-list").textContent).toContain(
    "matching.txt",
  );
  location.value = fs.DESKTOP;
  await search("matching", "files");
  expect(win.querySelector(".search-results-list").children.length).toBe(0);
  await search("Notepad", "applications");
  result = win.querySelector(".search-results-list").firstElementChild;
  expect(result.textContent).toContain("Notepad");
  win.querySelector('[data-search-action="back"]').click();
  expect(win.querySelector(".search-form-panel").hidden).toBeTrue();
});
