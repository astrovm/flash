// @ts-nocheck -- Happy DOM supplies browser objects for the classic launcher.
import { afterEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { fileURLToPath } from "node:url";
import { instrumentSource } from "./helpers/coverage";

const windows = [];
afterEach(() => {
  for (const w of windows.splice(0)) w.close();
});
const key = "astro-flash.scummvm.peril.iso.v1";
const tick = async () => {
  for (let i = 0; i < 12; i++) await new Promise((r) => setTimeout(r, 0));
};
async function launch(options = {}) {
  const w = new Window({
    url: "https://flash.test/iframe/peril/",
    settings: {
      disableJavaScriptFileLoading: true,
      disableCSSFileLoading: true,
      enableJavaScriptEvaluation: true,
      handleDisabledFileLoadingAsSuccess: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
  });
  windows.push(w);
  const files = new Map(options.files || []),
    removed = [],
    messages = [],
    notifications = [],
    requests = [];
  let aborted = 0,
    interval;
  const directory = {
    async getFileHandle(name, { create = false } = {}) {
      if (!files.has(name)) {
        if (!create) throw Error("missing file");
        files.set(name, new Blob());
      }
      return {
        async getFile() {
          return files.get(name);
        },
        async createWritable() {
          const chunks = [];
          return {
            async write(chunk) {
              if (options.failWrite) throw Error("disk full");
              chunks.push(chunk);
            },
            async close() {
              if (options.failManifest && name.endsWith(".json"))
                throw Error("manifest failed");
              files.set(name, new Blob(chunks));
            },
            async abort() {
              aborted++;
              if (options.failAbort) throw Error("abort failed");
            },
          };
        },
      };
    },
    async removeEntry(name) {
      removed.push(name);
      if (options.failRemove) throw Error("remove failed");
      files.delete(name);
    },
  };
  Object.defineProperty(w.navigator, "storage", {
    value: options.noStorage
      ? {}
      : {
          async getDirectory() {
            return {
              async getDirectoryHandle() {
                return directory;
              },
            };
          },
        },
  });
  Object.defineProperty(w.navigator, "serviceWorker", {
    value: {
      ready: Promise.resolve({
        active: { postMessage: (m) => notifications.push(m) },
      }),
    },
  });
  Object.assign(w, {
    Array,
    Object,
    Blob,
    Response,
    Request,
    URL,
    Uint8Array,
    __coverage__: globalThis.__coverage__,
    PINK_GAME: options.noGame
      ? undefined
      : {
          id: "peril",
          shellId: "pink-panther-passport-to-peril",
          title: "Passport",
          scummvmId: "pink:peril",
        },
    AstroStoragePolicy: options.noPolicy
      ? undefined
      : {
          errorMessage: (e) => e.message,
          async requestPersistence() {},
        },
    AstroIso9660: {
      async gameFilesFromIso() {
        if (options.invalidIso) throw Error("Wrong CD image");
        return {
          language: "English",
          gameFiles: [{ name: "PPTP.ORB", offset: 1, size: 3 }],
        };
      },
    },
    fetch: async (input) => {
      requests.push(input instanceof Request ? input.url : String(input));
      if (options.fetchError) throw Error("offline");
      return (
        options.response?.() ||
        new Response("ABCD", { headers: { "Content-Length": "4" } })
      );
    },
    setInterval: (fn) => {
      interval = fn;
      return 10;
    },
    clearInterval: () => {},
  });
  w.postMessage = (m) => messages.push(m);
  if (options.metadata !== undefined)
    w.localStorage.setItem(
      key,
      typeof options.metadata === "string"
        ? options.metadata
        : JSON.stringify(options.metadata),
    );
  const scriptErrors = [];
  w.addEventListener("error", (event) =>
    scriptErrors.push(event.error?.message || event.message),
  );
  const path = new URL("../site/iframe/scummvm/launcher.js", import.meta.url);
  const script = w.document.createElement("script");
  script.textContent = instrumentSource(
    await Bun.file(path).text(),
    fileURLToPath(path),
  );
  w.document.body.append(script);
  await tick();
  const q = (selector) => w.document.querySelector(selector);
  const select = async (iso, keep = false) => {
    q("#keep-copy").checked = keep;
    Object.defineProperty(q("#disc-input"), "files", {
      configurable: true,
      value: iso ? [iso] : [],
    });
    q("#disc-input").dispatchEvent(new w.Event("change"));
    await tick();
  };
  const download = async (url, keep = false) => {
    q("#keep-copy").checked = keep;
    q("#disc-url").value = url;
    q("#download-disc").click();
    await tick();
  };
  return {
    w,
    q,
    files,
    removed,
    messages,
    notifications,
    requests,
    select,
    download,
    aborted: () => aborted,
    scriptErrors,
    interval: () => interval?.(),
  };
}

test("local temporary ISO routes files without persistent storage and controls runtime audio/status", async () => {
  const h = await launch({ noStorage: true });
  await h.select();
  expect(h.q("#disc-panel").hidden).toBeFalse();
  await h.select(new Blob(["ABCDE"]));
  expect(h.q("#disc-panel").hidden).toBeTrue();
  expect(h.w.location.hash).toContain("pink:peril");
  expect(
    await (
      await h.w.fetch("/iframe/scummvm/local-games/peril/index.json")
    ).json(),
  ).toEqual({ "PPTP.ORB": 3 });
  expect(
    await (
      await h.w.fetch("/iframe/scummvm/local-games/peril/pptp.orb")
    ).text(),
  ).toBe("BCD");
  expect(
    (await h.w.fetch("/iframe/scummvm/local-games/peril/missing")).status,
  ).toBe(404);
  await h.w.fetch(new Request("https://external.test/file"));
  expect(h.requests).toContain("https://external.test/file");
  const m = h.w.Module;
  m.monitorRunDependencies(3);
  m.monitorRunDependencies(1);
  expect(h.q("#progress").value).toBe(2);
  expect(h.q("#progress").max).toBe(3);
  m.monitorRunDependencies(0);
  m.setStatus("");
  expect(h.q("#status").hidden).toBeTrue();
  m.onRuntimeInitialized();
  h.interval();
  const gain = { gain: { value: 1 }, connect() {} };
  let disconnected = false,
    connected = false;
  m.SDL3 = {
    audioContext: { createGain: () => gain, destination: {} },
    audio_playback: {
      scriptProcessorNode: {
        disconnect() {
          disconnected = true;
        },
        connect() {
          connected = true;
        },
      },
    },
  };
  h.w.dispatchEvent(
    new h.w.MessageEvent("message", {
      origin: "https://evil.test",
      data: { type: "setVolume", volume: 0 },
    }),
  );
  h.interval();
  expect(disconnected && connected).toBeTrue();
  expect(gain.gain.value).toBe(1);
  for (const [volume, expected] of [
    [0.3, 0.3],
    [2, 1],
    [-1, 0],
    [NaN, 0],
  ]) {
    h.w.dispatchEvent(
      new h.w.MessageEvent("message", {
        origin: h.w.location.origin,
        data: { type: "setVolume", volume },
      }),
    );
    expect(gain.gain.value).toBe(expected);
  }
  m.onAbort("missing data");
  expect(h.q("#message").textContent).toContain("missing data");
  expect(h.q("#disc-input").disabled).toBeFalse();
  h.q("script[src]").dispatchEvent(new h.w.Event("error"));
  expect(h.q("#message").textContent).toContain("runtime could not be loaded");
});

test("saved copies write a manifest, notify the shell, and replace the old file", async () => {
  const h = await launch({
    metadata: {
      fileName: "old.iso",
      language: "Spanish",
      url: "https://old.test/game.iso",
    },
    files: [["old.iso", new Blob(["old"])]],
  });
  expect(h.q("#saved-copy").hidden).toBeFalse();
  expect(h.q("#disc-url").value).toContain("old.test");
  await h.select(new Blob(["ABCDE"]), true);
  const metadata = JSON.parse(h.w.localStorage.getItem(key));
  expect(metadata.language).toBe("English");
  expect(h.removed).toEqual(["old.iso"]);
  const manifest = JSON.parse(await h.files.get("peril-manifest.json").text());
  expect(manifest.files).toEqual({ "PPTP.ORB": { offset: 1, size: 3 } });
  expect(manifest.isoSize).toBe(5);
  expect(h.notifications).toEqual([
    { type: "SCUMMVM_GAME_UPDATED", gameId: "peril" },
  ]);
  expect(h.messages.map((x) => x.event)).toContain("astro.offline-game-ready");
  h.w.Module.onAbort("retry");
  h.q("#saved-copy").click();
  await tick();
  expect(h.q("#disc-panel").hidden).toBeTrue();
});

test("stale and malformed metadata do not offer a broken saved copy", async () => {
  for (const metadata of [{ fileName: "missing.iso" }, "{bad"]) {
    const h = await launch({ metadata });
    expect(h.q("#saved-copy").hidden).toBeTrue();
    if (typeof metadata === "object")
      expect(h.w.localStorage.getItem(key)).toBeNull();
  }
});

test("storage and image failures restore controls and clean partial writes", async () => {
  for (const options of [
    { noStorage: true },
    { invalidIso: true },
    { failWrite: true },
    { failManifest: true },
    {
      failManifest: true,
      metadata: { fileName: "old.iso" },
      files: [["old.iso", new Blob(["old"])]],
    },
    { failManifest: true, failRemove: true },
  ]) {
    const h = await launch(options);
    await h.select(new Blob(["ABCDE"]), true);
    expect(h.q("#disc-input").disabled).toBeFalse();
    expect(h.q("#message").textContent).toMatch(
      /unavailable|Wrong CD|disk full|manifest failed/,
    );
    if (options.failWrite) {
      expect(h.aborted()).toBe(1);
      expect(h.removed.length).toBe(1);
    }
    if (options.failRemove)
      expect(h.removed).toEqual([expect.stringMatching(/^peril-.+\.iso$/)]);
    if (options.failManifest)
      expect(h.w.localStorage.getItem(key)).toBe(
        options.metadata ? JSON.stringify(options.metadata) : null,
      );
  }
  const h = await launch();
  await h.select({ size: 801 * 1024 * 1024 });
  expect(h.q("#message").textContent).toContain("800 MiB");
});

test("HTTP download supports temporary and retained copies", async () => {
  for (const keep of [false, true]) {
    const h = await launch();
    await h.download("https://cdn.test/disc.iso", keep);
    expect(h.q("#disc-panel").hidden).toBeTrue();
    if (keep) {
      const meta = JSON.parse(h.w.localStorage.getItem(key));
      expect(meta.url).toBe("https://cdn.test/disc.iso");
      expect(await h.files.get(meta.fileName).text()).toBe("ABCD");
    } else
      expect(
        await (
          await h.w.fetch("/iframe/scummvm/local-games/peril/PPTP.ORB")
        ).text(),
      ).toBe("BCD");
  }
});

test("download validation reports URL, network, streaming and size errors", async () => {
  const cases = [
    [{}, "no-url", "valid HTTP"],
    [{}, "file:///disc.iso", "must use HTTP"],
    [{ fetchError: true }, "https://cdn.test/disc.iso", "CORS"],
    [
      { response: () => new Response("", { status: 403 }) },
      "https://cdn.test/disc.iso",
      "HTTP 403",
    ],
    [
      { response: () => new Response(null) },
      "https://cdn.test/disc.iso",
      "cannot stream",
    ],
    [
      {
        response: () =>
          new Response("data", {
            headers: { "Content-Length": String(801 * 1024 * 1024) },
          }),
      },
      "https://cdn.test/disc.iso",
      "800 MiB",
    ],
    [{ invalidIso: true }, "https://cdn.test/disc.iso", "Wrong CD"],
    [{ failWrite: true }, "https://cdn.test/disc.iso", "disk full"],
  ];
  for (const [options, url, error] of cases) {
    const h = await launch(options);
    await h.download(url, true);
    expect(h.q("#message").textContent).toContain(error);
    expect(h.q("#download-disc").disabled).toBeFalse();
  }
});

test("the launcher requires its game configuration and storage policy", async () => {
  for (const [options, message] of [
    [{ noGame: true }, "Missing Pink Panther game configuration."],
    [{ noPolicy: true }, "Missing browser storage policy."],
  ]) {
    const h = await launch(options);
    expect(h.scriptErrors.join("\n")).toContain(message);
  }
});

test("runtime logging, temporary copies, and cleanup failures are handled", async () => {
  const h = await launch({
    metadata: { fileName: "old.iso", language: "Spanish" },
    files: [["old.iso", new Blob(["old"])]],
  });
  await h.select(new Blob(["ABCDE"]), false);
  expect(JSON.parse(h.w.localStorage.getItem(key)).fileName).toBe("old.iso");
  const logs = [];
  const originalLog = h.w.console.log;
  const originalError = h.w.console.error;
  h.w.console.log = (...values) => logs.push(["log", ...values]);
  h.w.console.error = (...values) => logs.push(["error", ...values]);
  try {
    h.w.Module.print("hello");
    h.w.Module.printErr("oops");
  } finally {
    h.w.console.log = originalLog;
    h.w.console.error = originalError;
  }
  expect(logs).toEqual([
    ["log", "hello"],
    ["error", "oops"],
  ]);

  const failing = await launch({
    failRemove: true,
    metadata: { fileName: "old.iso" },
    files: [["old.iso", new Blob(["old"])]],
  });
  await failing.select(new Blob(["ABCDE"]), true);
  expect(failing.q("#disc-panel").hidden).toBeTrue();

  for (const options of [
    { failWrite: true, failAbort: true, failRemove: true },
  ]) {
    const partial = await launch(options);
    await partial.select(new Blob(["ABCDE"]), true);
    expect(partial.q("#message").textContent).toContain("disk full");
    const download = await launch(options);
    await download.download("https://cdn.test/disc.iso", true);
    expect(download.q("#message").textContent).toContain("disk full");
  }
});

test("saved copies that disappear and downloads without a length are handled", async () => {
  const h = await launch({
    metadata: { fileName: "old.iso" },
    files: [["old.iso", new Blob(["old"])]],
  });
  h.w.localStorage.removeItem(key);
  h.q("#saved-copy").click();
  await tick();
  expect(h.q("#disc-input").disabled).toBeFalse();
  expect(h.q("#message").textContent).not.toBe("");
  const none = await launch();
  none.q("#saved-copy").click();
  await tick();
  expect(none.q("#disc-panel").hidden).toBeFalse();
  const unsized = await launch({
    response: () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode("ABCD"));
            controller.close();
          },
        }),
      ),
  });
  await unsized.download("https://cdn.test/disc.iso");
  expect(unsized.q("#disc-panel").hidden).toBeTrue();
  const large = await launch({
    response: () =>
      new Response("ABCD", {
        headers: { "Content-Length": String(150 * 1024 * 1024) },
      }),
  });
  await large.download("https://cdn.test/disc.iso");
  expect(large.q("#disc-panel").hidden).toBeTrue();
});

test("downloads that grow past the size limit are cancelled and discarded", async () => {
  let cancelled = 0;
  const oversized = () => ({
    ok: true,
    status: 200,
    headers: new Headers(),
    body: {
      getReader: () => ({
        read: async () => ({
          done: false,
          value: { byteLength: 801 * 1024 * 1024 },
        }),
        cancel: async () => {
          cancelled += 1;
        },
      }),
    },
  });
  for (const keep of [false, true]) {
    const h = await launch({ response: oversized });
    await h.download("https://cdn.test/disc.iso", keep);
    expect(h.q("#message").textContent).toContain("exceeds the 800 MiB limit");
    expect(h.q("#download-disc").disabled).toBeFalse();
    expect(h.aborted()).toBe(keep ? 1 : 0);
    expect(h.removed).toHaveLength(keep ? 1 : 0);
    expect(h.w.localStorage.getItem(key)).toBeNull();
  }
  expect(cancelled).toBe(2);
});

test("a volume chosen before audio starts applies when the output connects", async () => {
  const h = await launch({ noStorage: true });
  await h.select(new Blob(["ABCDE"]));
  h.w.dispatchEvent(
    new h.w.MessageEvent("message", {
      origin: h.w.location.origin,
      data: { type: "setVolume", volume: 0.4 },
    }),
  );
  const gain = { gain: { value: 1 }, connect() {} };
  h.w.Module.SDL3 = {
    audioContext: { createGain: () => gain, destination: {} },
    audio_playback: {
      scriptProcessorNode: { disconnect() {}, connect() {} },
    },
  };
  h.w.Module.onRuntimeInitialized();
  h.interval();
  expect(gain.gain.value).toBe(0.4);
});
