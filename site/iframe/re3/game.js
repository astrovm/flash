import { loadPackedManifest } from "./packed-store.js";

// Starts re3. The page's data files are copied into the engine's in-memory
// filesystem first, since re3 opens its files by path and reads them
// synchronously. Saves and settings live in IndexedDB.
const params = new URLSearchParams(location.search);
const session = params.get("session") === "1";
const canvas = document.getElementById("canvas");
const status = document.getElementById("status");
const bar = document.getElementById("progress");
const GAME_DIRECTORY = "/gta3";
const SAVE_DIRECTORY = `${GAME_DIRECTORY}/userfiles`;
const SETTINGS_FILE = "re3.ini";
// Streams of music and radio run to tens of megabytes each. They stay out of
// memory, so the radio is silent, while the sound effect banks load.
const MAX_AUDIO_STREAM = 4 * 1024 * 1024;

const show = (text) => {
  status.textContent = text;
};

const fail = (error) => {
  console.error(error);
  show(error.message || String(error));
  status.classList.add("error");
  bar.hidden = true;
};

const normalize = (path) =>
  String(path).replaceAll("\\", "/").replace(/^\/+/, "").toLowerCase();

const isStream = (path, size) =>
  /^audio\/(?!sfx)[^/]+\.(?:wav|mp3)$/.test(path) && size > MAX_AUDIO_STREAM;

// ---- Where the files come from: the packed copy, or the setup page ----
const localAssetUrl = (path) =>
  `local-assets/${path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/")}`;

const askParent = (message) =>
  new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = ({ data }) =>
      data.error ? reject(new Error(data.error)) : resolve(data);
    window.parent.postMessage(message, location.origin, [channel.port2]);
  });

const listFiles = async () => {
  if (session) {
    const { files } = await askParent({ event: "re3.file-list" });
    return files;
  }
  const manifest = await loadPackedManifest();
  if (!manifest) throw new Error("The game data isn't installed.");
  return Object.entries(manifest.files).map(([path, { length }]) => ({
    path,
    size: length,
  }));
};

// Streams a file's bytes to `write` in chunks.
const readFile = async (path, write) => {
  if (session) {
    const { buffer } = await askParent({ event: "re3.asset-request", path });
    write(new Uint8Array(buffer));
    return;
  }
  const response = await fetch(localAssetUrl(path), { cache: "no-store" });
  if (!response.ok) throw new Error(`Game file missing: ${path}`);
  const reader = response.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return;
    write(value);
  }
};

const readOverlay = async (path) => {
  const response = await fetch(`gamefiles/${path}`);
  if (!response.ok) throw new Error(`The engine files didn't load: ${path}`);
  return new Uint8Array(await response.arrayBuffer());
};

// ---- Copying into the engine's filesystem ----
const writeFile = (FS, path) => {
  const target = `${GAME_DIRECTORY}/${path}`;
  FS.mkdirTree(target.slice(0, target.lastIndexOf("/")));
  const stream = FS.open(target, "w");
  return {
    write(chunk) {
      FS.write(stream, chunk, 0, chunk.length);
    },
    close() {
      FS.close(stream);
    },
  };
};

const loadGameFiles = async (FS) => {
  const files = (await listFiles())
    .map(({ path, size }) => ({ path: normalize(path), size }))
    .filter(({ path, size }) => !isStream(path, size));
  if (!files.some(({ path }) => path === "models/gta3.img")) {
    throw new Error(
      "models/gta3.img isn't in the selected folder. Pick your GTA III folder.",
    );
  }
  const total = files.reduce((sum, { size }) => sum + size, 0);
  let done = 0;
  bar.hidden = false;
  bar.max = total;
  for (const { path } of files) {
    const out = writeFile(FS, path);
    try {
      await readFile(path, (chunk) => {
        out.write(chunk);
        done += chunk.length;
        bar.value = done;
      });
    } finally {
      out.close();
    }
    show(`Loading game files… ${Math.floor((done / total) * 100)}%`);
  }
  // The engine's own files go over the game's, like re3's install steps.
  const overlay = await (await fetch("gamefiles.json")).json();
  for (const path of overlay) {
    const out = writeFile(FS, path);
    out.write(await readOverlay(path));
    out.close();
  }
};

// ---- Saves and settings ----
const syncFilesystem = (FS, populate) =>
  new Promise((resolve) => FS.syncfs(populate, () => resolve()));

const mountSaves = async (FS) => {
  FS.mkdirTree(SAVE_DIRECTORY);
  FS.mount(FS.filesystems.IDBFS, {}, SAVE_DIRECTORY);
  await syncFilesystem(FS, true);
  const saved = `${SAVE_DIRECTORY}/${SETTINGS_FILE}`;
  if (FS.analyzePath(saved).exists)
    FS.writeFile(`${GAME_DIRECTORY}/${SETTINGS_FILE}`, FS.readFile(saved));
};

// The engine keeps its settings beside the game; copy them into the saved
// folder so they last too.
const keepSaving = (FS) => {
  const settings = `${GAME_DIRECTORY}/${SETTINGS_FILE}`;
  let last = "";
  const save = () => {
    if (FS.analyzePath(settings).exists) {
      const text = FS.readFile(settings, { encoding: "utf8" });
      if (text !== last) {
        last = text;
        FS.writeFile(`${SAVE_DIRECTORY}/${SETTINGS_FILE}`, text);
      }
    }
    void syncFilesystem(FS, false);
  };
  setInterval(save, 5000);
  window.addEventListener("pagehide", save);
};

const start = async () => {
  show("Starting…");
  bar.hidden = false;
  const module = await createRe3Module({
    canvas,
    noInitialRun: true,
    locateFile: (file) => new URL(file, location.href).href,
    print: (text) => console.log(text),
    printErr: (text) => console.warn(text),
  });
  const { FS } = module;
  FS.mkdirTree(GAME_DIRECTORY);
  await loadGameFiles(FS);
  await mountSaves(FS);
  keepSaving(FS);
  FS.chdir(GAME_DIRECTORY);
  document.body.classList.add("playing");
  show("");
  bar.hidden = true;
  canvas.focus();
  await module.callMain([]);
};

const script = document.createElement("script");
script.src = "re3.js";
script.onload = () => start().catch(fail);
script.onerror = () => fail(new Error("The engine didn't load."));
document.head.append(script);
