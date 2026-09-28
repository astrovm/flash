// @ts-nocheck -- Real Explorer windows driven through Happy DOM events.
import { afterEach, expect, test } from "bun:test";
import {
  cleanupShells,
  flushShell,
  loadShell,
  login,
} from "./helpers/shell-harness";

afterEach(cleanupShells);

const settle = async () => {
  await flushShell();
  await flushShell();
};
const dialogText = (s) =>
  [...s.document.querySelectorAll(".xp-dialog")].at(-1)?.textContent || "";
const answer = async (s, id) => {
  [...s.document.querySelectorAll(".xp-dialog")]
    .at(-1)
    .querySelector(`[data-action="${id}"]`)
    .click();
  await settle();
};

async function openDocuments(options) {
  const s = await login(await loadShell(options)),
    fs = s.window.VirtualFS;
  const folder = fs.createFolder(fs.MY_DOCUMENTS, "Browse");
  const nested = fs.createFolder(folder.id, "Nested");
  const note = fs.createFile(folder.id, "note.txt", { content: "note" });
  fs.open(folder.id);
  await flushShell();
  const win = s.document.querySelector(
    '.xp-window[data-game="__my-documents"]',
  );
  const item = (id) =>
    win.querySelector(`.explorer-item[data-node-id="${id}"]`);
  const menu = (name) =>
    win.querySelector(`[data-explorer-menu="${name}"]`).click();
  const command = async (name) => {
    win.querySelector(`[data-explorer-command="${name}"]`).click();
    await settle();
  };
  const subcommand = async (name) => {
    win.querySelector(`[data-explorer-subcommand="${name}"]`).click();
    await settle();
  };
  const action = async (name) => {
    win.querySelector(`[data-explorer-action="${name}"]`).click();
    await settle();
  };
  const address = () => win.querySelector(".explorer-address input");
  return {
    s,
    fs,
    folder,
    nested,
    note,
    win,
    item,
    menu,
    command,
    subcommand,
    action,
    address,
  };
}

test("Explorer menus run file, edit, view and go-to commands", async () => {
  const h = await openDocuments(),
    { s, fs } = h;
  h.item(h.note.id).click();
  h.menu("file");
  await h.command("properties-current");
  expect(dialogText(s)).toContain("note.txt Properties");
  await answer(s, "ok");
  h.menu("file");
  h.win
    .querySelector('[data-explorer-command="folder-menu"]')
    .dispatchEvent(new s.window.Event("pointerover", { bubbles: true }));
  expect(
    h.win.querySelector(".explorer-submenu, [data-explorer-submenu-name]"),
  ).toBeDefined();
  await h.command("folder-menu");
  await h.subcommand("properties-current");
  expect(dialogText(s)).toContain("Browse Properties");
  await answer(s, "ok");

  h.item(h.note.id).click();
  h.menu("edit");
  h.win
    .querySelector('[data-explorer-command="cut"]')
    .dispatchEvent(new s.window.Event("pointerover", { bubbles: true }));
  await h.command("cut");
  expect(s.window.FileOperations.getClipboard().mode).toBe("cut");
  h.menu("file");
  s.window.prompt = () => null;
  await h.command("rename");
  expect(fs.getNode(h.note.id).name).toBe("note.txt");
  h.menu("file");
  s.window.prompt = () => "memo.txt";
  await h.command("rename");
  expect(fs.getNode(h.note.id).name).toBe("memo.txt");
  h.item(h.note.id).click();
  h.menu("file");
  await h.command("delete");
  await answer(s, "no");

  h.menu("view");
  await h.command("explorer-bar");
  await h.subcommand("folders-bar");
  expect(
    h.win
      .querySelector('[data-explorer-action="folders"]')
      .getAttribute("aria-pressed"),
  ).toBe("true");
  h.menu("view");
  await h.command("explorer-bar");
  await h.subcommand("search-current");
  expect(
    !!s.document.querySelector('.xp-window[data-game="__search"]'),
  ).toBeTrue();
  h.menu("view");
  await h.command("go-to");
  await h.subcommand("up-one-level");
  expect(h.address().value).toBe(fs.getPath(fs.MY_DOCUMENTS));
  h.menu("view");
  await h.command("go-to");
  await h.subcommand("my-computer");
  expect(h.address().value).toBe("My Computer");
  h.menu("file");
  await h.command("delete-current");
  expect(dialogText(s)).toContain("Cannot delete My Computer.");
  await answer(s, "ok");
  h.menu("file");
  await h.command("rename-current");
  expect(dialogText(s)).toContain("Cannot rename My Computer.");
  await answer(s, "ok");
  h.menu("file");
  await h.command("close");
  expect(h.win.isConnected).toBeFalse();
});

test("Explorer toolbar, address bar, tree, and task panes navigate folders", async () => {
  const h = await openDocuments(),
    { s, fs } = h;
  await h.action("search");
  await h.action("view");
  expect(h.win.querySelector(".explorer-items").dataset.view).toBe(
    "thumbnails",
  );
  h.address().value = "C:\\missing";
  await h.action("go");
  expect(h.address().value).toBe(fs.getPath(h.folder.id));
  h.address().value = fs.getPath(h.note.id);
  h.address().dispatchEvent(new s.window.Event("change"));
  expect(h.address().value).toBe(fs.getPath(h.folder.id));
  h.address().value = "My Computer";
  h.address().dispatchEvent(new s.window.Event("change"));
  expect(h.address().value).toBe("My Computer");
  await h.action("up");
  expect(h.address().value).toBe(fs.getPath(fs.DESKTOP));

  const toggles = [...h.win.querySelectorAll(".explorer-section-toggle")];
  toggles[0].click();
  expect(toggles[0].getAttribute("aria-expanded")).toBe("false");
  toggles[0].click();
  expect(toggles[0].getAttribute("aria-expanded")).toBe("true");
  h.win.querySelector('.explorer-sidebar [data-place="computer"]').click();
  expect(h.address().value).toBe("My Computer");
  h.win.querySelector('.explorer-sidebar [data-place="documents"]').click();
  expect(h.address().value).toBe(fs.getPath(fs.MY_DOCUMENTS));

  const tree = () => [...h.win.querySelectorAll(".explorer-tree-item")];
  const row = (id) => tree().find((entry) => entry.dataset.nodeId === id);
  row(fs.MY_DOCUMENTS).dispatchEvent(new s.window.MouseEvent("dblclick"));
  row(fs.MY_DOCUMENTS).dispatchEvent(new s.window.MouseEvent("dblclick"));
  row(fs.MY_DOCUMENTS).click();
  row(h.folder.id).click();
  row(h.folder.id).click();
  expect(h.address().value).toBe(fs.getPath(h.folder.id));
  row(h.nested.id).click();
  expect(h.address().value).toBe(fs.getPath(h.nested.id));

  const tasks = h.win.querySelector(".explorer-sidebar .explorer-section-body");
  [...tasks.querySelectorAll("button")]
    .find((button) => button.textContent.includes("Make a new folder"))
    .click();
  await settle();
  expect(fs.findChild(h.nested.id, "New Folder")).toBeTruthy();
  h.win
    .querySelector(".explorer-main")
    .dispatchEvent(new s.window.PointerEvent("pointerdown", { bubbles: true }));
  expect(s.document.activeElement).toBe(h.win.querySelector(".explorer-items"));
});

test("Recycle Bin tasks restore and delete selected items", async () => {
  const s = await login(await loadShell()),
    fs = s.window.VirtualFS;
  const files = ["a.txt", "b.txt", "c.txt"].map((name) =>
    fs.createFile(fs.DESKTOP, name),
  );
  files.forEach((file) => fs.remove(file.id));
  await settle();
  s.document
    .querySelector('[data-desktop-id="__recycle-bin"]')
    .dispatchEvent(new s.window.MouseEvent("dblclick", { bubbles: true }));
  await settle();
  const win = s.document.querySelector('.xp-window[data-game="__recycle-bin"]');
  const task = (label) =>
    [...win.querySelectorAll(".recycle-task")].find(
      (button) => button.textContent === label,
    );
  const item = (id) =>
    win.querySelector(`.explorer-item[data-node-id="${id}"]`);
  task("Restore selected items").click();
  task("Delete selected items").click();
  await settle();
  expect(s.document.querySelector(".xp-dialog")).toBeFalsy();
  item(files[0].id).click();
  task("Restore selected items").click();
  await settle();
  expect(fs.getNode(files[0].id).parent).toBe(fs.DESKTOP);
  item(files[1].id).click();
  task("Delete selected items").click();
  await answer(s, "yes");
  expect(fs.getNode(files[1].id)).toBeNull();

  const restore = s.window.FileOperations.restore;
  s.window.FileOperations.restore = async () => {
    throw new Error("");
  };
  try {
    item(files[2].id).click();
    task("Restore selected items").click();
    await settle();
    expect(dialogText(s)).toContain("The file operation failed.");
    await answer(s, "ok");
    task("Restore all items").click();
    await settle();
    expect(dialogText(s)).toContain("The file operation failed.");
    await answer(s, "ok");
    s.window.FileOperations.restore = async () => {
      throw new Error("The Desktop is full.");
    };
    task("Restore all items").click();
    await settle();
    expect(dialogText(s)).toContain("Restore files");
    expect(dialogText(s)).toContain("The Desktop is full.");
    await answer(s, "ok");
    expect(fs.getNode(files[2].id).parent).toBe(fs.RECYCLE_BIN);
  } finally {
    s.window.FileOperations.restore = restore;
  }
  task("Restore all items").click();
  await settle();
  expect(fs.getChildren(fs.RECYCLE_BIN)).toHaveLength(0);
});

test("Explorer context menus handle declined and failing commands and keyboard use", async () => {
  const h = await openDocuments(),
    { s, fs } = h;
  const context = (id) => {
    h.item(id).dispatchEvent(
      new s.window.MouseEvent("contextmenu", { bubbles: true }),
    );
    return h.win.querySelector(".explorer-context-menu");
  };
  let menu = context(h.note.id);
  const press = (key) =>
    menu.dispatchEvent(
      new s.window.KeyboardEvent("keydown", { key, bubbles: true }),
    );
  press("a");
  press("Enter");
  await settle();
  expect(menu.isConnected).toBeFalse();

  menu = context(h.note.id);
  s.window.prompt = () => null;
  menu.querySelector('[data-command="rename"]').click();
  await settle();
  expect(fs.getNode(h.note.id).name).toBe("note.txt");
  menu = context(h.note.id);
  menu.dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(menu.isConnected).toBeTrue();
  menu.querySelector('[data-command="open"]').click();
  await settle();

  fs.remove(h.note.id);
  fs.open(fs.RECYCLE_BIN);
  await settle();
  const bin = h.win;
  const binItem = bin.querySelector(
    `.explorer-item[data-node-id="${h.note.id}"]`,
  );
  binItem.dispatchEvent(
    new s.window.MouseEvent("contextmenu", { bubbles: true }),
  );
  bin
    .querySelector('.explorer-context-menu [data-command="permanent"]')
    .click();
  await answer(s, "no");
  expect(fs.getNode(h.note.id)).toBeTruthy();
  const restore = s.window.FileOperations.restore;
  s.window.FileOperations.restore = async () => {
    throw new Error("");
  };
  try {
    binItem.dispatchEvent(
      new s.window.MouseEvent("contextmenu", { bubbles: true }),
    );
    bin
      .querySelector('.explorer-context-menu [data-command="restore"]')
      .click();
    await settle();
    expect(dialogText(s)).toContain("The file operation failed.");
  } finally {
    s.window.FileOperations.restore = restore;
  }
});

test("Explorer shows game icons, descriptions, and survives failing file handlers", async () => {
  const installed = {
    "flashpoint:iconless": {
      title: "Iconless",
      type: "swf",
      installed: true,
      url: "https://flash.example/iconless.swf",
    },
  };
  const h = await openDocuments({
    gameLibraryManager: {
      subscribe: () => () => {},
      initialize: async () => installed,
      getRecord: () => null,
    },
  });
  const { s, fs } = h;
  const withIcon = fs.createFile(h.folder.id, "Bike.game", {
    app: "bike-mania",
  });
  const iconless = fs.createFile(h.folder.id, "Iconless.game", {
    app: "flashpoint:iconless",
  });
  const plain = fs.createFile(h.folder.id, "README");
  fs.registerFileType(".boom", () => {
    throw new Error("handler failed");
  });
  const boom = fs.createFile(h.folder.id, "fail.boom");
  await settle();
  expect(h.item(withIcon.id).querySelector("img")).toBeTruthy();
  expect(
    h.item(iconless.id).querySelector(".explorer-item-emoji"),
  ).toBeTruthy();
  expect(h.item(withIcon.id).textContent).toContain("Game");
  expect(h.item(plain.id).textContent).toContain("File file");
  const errors = [];
  const originalError = s.window.console.error;
  s.window.console.error = (error) => errors.push(error);
  try {
    h.item(boom.id).dispatchEvent(new s.window.MouseEvent("dblclick"));
  } finally {
    s.window.console.error = originalError;
  }
  expect(errors[0].message).toBe("handler failed");
});

test("Explorer returns to My Computer when its folder is deleted and opens Recycle Bin shortcuts", async () => {
  const h = await openDocuments(),
    { s, fs } = h;
  await fs.destroy(h.folder.id);
  await settle();
  expect(h.address().value).toBe("My Computer");
  const shortcut = fs.createFile(fs.DESKTOP, "Shortcut to Recycle Bin.game", {
    app: "__recycle-bin",
  });
  fs.open(shortcut.id);
  await settle();
  expect(
    !!s.document.querySelector('.xp-window[data-game="__recycle-bin"]'),
  ).toBeTrue();
  const unknown = fs.createFile(fs.DESKTOP, "Unknown.game", {
    app: "missing-game",
  });
  fs.open(unknown.id);
});

test("Explorer rename shortcuts keep names on cancel and report failures", async () => {
  const h = await openDocuments(),
    { s, fs } = h;
  const item = h.item(h.note.id);
  s.window.prompt = () => null;
  item.dispatchEvent(
    new s.window.KeyboardEvent("keydown", { key: "F2", bubbles: true }),
  );
  await settle();
  expect(fs.getNode(h.note.id).name).toBe("note.txt");
  const rename = s.window.FileOperations.rename;
  s.window.FileOperations.rename = async () => {
    throw new Error("");
  };
  s.window.prompt = () => "other.txt";
  try {
    h.item(h.note.id).dispatchEvent(
      new s.window.KeyboardEvent("keydown", { key: "F2", bubbles: true }),
    );
    await settle();
  } finally {
    s.window.FileOperations.rename = rename;
  }
  expect(dialogText(s)).toContain("The file operation failed.");
});

test("Search lists games without desktop shortcuts and opens them", async () => {
  const s = await login(await loadShell()),
    fs = s.window.VirtualFS;
  fs.findByApp("bike-mania").forEach((node) => fs.destroy(node.id));
  s.document.getElementById("start-button").click();
  s.document.querySelector('[data-start-action="search"]').click();
  const win = s.document.querySelector('.xp-window[data-game="__search"]');
  win.querySelector("[data-search-kind]").click();
  win.querySelector("#search-filename").value = "Bike Mania";
  win.querySelector("#search-type").value = "games";
  win.querySelector("#search-type").dispatchEvent(new s.window.Event("change"));
  const result = [...win.querySelector(".search-results-list").children].find(
    (item) => item.textContent === "Bike ManiaGame",
  );
  expect(result).toBeTruthy();
  s.window.RufflePlayer = {
    newest: () => ({
      createPlayer: () => {
        const player = s.document.createElement("ruffle-player");
        player.load = () => {};
        return player;
      },
    }),
  };
  result.dispatchEvent(new s.window.MouseEvent("dblclick"));
  await settle();
  expect(
    !!s.document.querySelector('.xp-window[data-game="bike-mania"]'),
  ).toBeTrue();
});

test("Explorer shows current folder properties and goes up from My Computer to the Desktop", async () => {
  const h = await openDocuments(),
    { s, fs } = h;
  h.menu("file");
  await h.command("properties-current");
  expect(dialogText(s)).toContain("Browse Properties");
  await answer(s, "ok");

  h.win.querySelector('.explorer-sidebar [data-place="computer"]').click();
  h.menu("view");
  await h.command("go-to");
  await h.subcommand("up-one-level");
  expect(h.address().value).toBe(fs.getPath(fs.DESKTOP));
  await h.action("up");
  expect(h.address().value).toBe(fs.getPath(fs.USER_PROFILE));
});

test("Explorer reports failing menu commands with their message or a default", async () => {
  const h = await openDocuments(),
    { s } = h;
  const copy = s.window.FileOperations.copy;
  try {
    for (const [message, expected] of [
      ["Clipboard is locked.", "Clipboard is locked."],
      ["", "The file operation failed."],
    ]) {
      s.window.FileOperations.copy = () => {
        throw new Error(message);
      };
      h.item(h.note.id).click();
      h.menu("edit");
      await h.command("copy");
      expect(dialogText(s)).toContain(expected);
      await answer(s, "ok");
    }
  } finally {
    s.window.FileOperations.copy = copy;
  }
});

test("Explorer menus keep submenus open over separators and ignore unknown access keys", async () => {
  const h = await openDocuments(),
    { s } = h;
  h.menu("view");
  h.win
    .querySelector('[data-explorer-command="go-to"]')
    .dispatchEvent(new s.window.Event("pointerover", { bubbles: true }));
  const submenu = h.win.querySelector("[data-explorer-submenu-name]");
  expect(submenu.hidden).toBeFalse();
  const menu = h.win.querySelector("[data-explorer-menu-name]");
  menu
    .querySelector(":scope > :not(button)")
    .dispatchEvent(new s.window.Event("pointerover", { bubbles: true }));
  expect(submenu.hidden).toBeFalse();
  menu
    .querySelector(
      '[data-explorer-command="refresh"], .game-menu-item:not(.has-submenu)',
    )
    .dispatchEvent(new s.window.Event("pointerover", { bubbles: true }));
  expect(submenu.hidden).toBeTrue();

  menu.hidden = true;
  h.win.querySelector(".explorer-address input").dispatchEvent(
    new s.window.KeyboardEvent("keydown", {
      key: "q",
      altKey: true,
      bubbles: true,
      cancelable: true,
    }),
  );
  expect(menu.hidden).toBeTrue();
});

test("pressing an Explorer item keeps focus off the item list", async () => {
  const h = await openDocuments(),
    { s } = h;
  const items = h.win.querySelector(".explorer-items");
  const item = h.item(h.note.id);
  item.focus();
  item.dispatchEvent(
    new s.window.PointerEvent("pointerdown", { bubbles: true }),
  );
  expect(s.document.activeElement).not.toBe(items);
});
