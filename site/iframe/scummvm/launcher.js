"use strict";

(() => {
  const game = window.PINK_GAME;
  if (!game) throw new Error("Missing Pink Panther game configuration.");

  const SCUMMVM_ROOT = "../../vendor/scummvm/2026.3.0/";
  const SCUMMVM_GAME_ROUTE = `/iframe/scummvm/local-games/${game.id}/`;
  const STORAGE_DIRECTORY = "astro-flash-scummvm";
  const metadataKey = `astro-flash.scummvm.${game.id}.iso.v1`;
  const runtimeManifestName = `${game.id}-manifest.json`;
  let currentVolume = 1;
  let outputGain = null;
  let savedIso = null;
  let temporaryIso = null;
  let temporaryGameFiles = null;

  document.documentElement.innerHTML = `
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
      <title></title>
      <style>
        :root { color-scheme: dark; font-family: Tahoma, sans-serif; }
        * { box-sizing: border-box; }
        html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #000; }
        body { display: grid; place-items: center; color: #fff; }
        #disc-panel {
          position: relative;
          z-index: 2;
          width: min(34rem, calc(100% - 2rem));
          padding: 1.5rem;
          border: 1px solid #6f82a5;
          border-radius: 8px;
          background: linear-gradient(#23375d, #101a30);
          box-shadow: 0 12px 30px #000a;
          text-align: center;
        }
        h1 { margin: 0 0 .75rem; font-size: 1.25rem; }
        p { margin: .5rem 0 1rem; line-height: 1.4; color: #dce6fa; }
        button {
          min-height: 2.25rem;
          padding: 0 1.1rem;
          border: 1px solid #fff;
          border-radius: 4px;
          background: linear-gradient(#fff, #c7d4eb);
          color: #10203c;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        button:disabled { cursor: wait; opacity: .65; }
        .source-label { display: block; margin: 1rem 0 .35rem; text-align: left; }
        .url-row { display: flex; gap: .5rem; }
        #disc-url {
          min-width: 0;
          flex: 1;
          padding: .55rem .65rem;
          border: 1px solid #8fa3c9;
          border-radius: 4px;
          background: #fff;
          color: #111;
          font: inherit;
        }
        #saved-copy { margin-top: .85rem; }
        .keep-copy { display: block; margin: .85rem 0 0; text-align: left; color: #dce6fa; }
        .divider { margin: 1rem 0; color: #aebbd3; }
        #message { min-height: 1.4rem; margin: .75rem 0 0; color: #ffdf82; }
        #disc-input { display: block; max-width: 100%; margin: 0 auto; font: inherit; color: #dce6fa; }
        #disc-input::file-selector-button {
          min-height: 2.25rem;
          margin-right: .75rem;
          padding: 0 1.1rem;
          border: 1px solid #fff;
          border-radius: 4px;
          background: linear-gradient(#fff, #c7d4eb);
          color: #10203c;
          font: inherit;
          font-weight: 700;
          cursor: pointer;
        }
        #status {
          position: absolute;
          z-index: 3;
          right: 0;
          bottom: 1rem;
          padding: .5rem 1rem;
          border-radius: 1rem 0 0 1rem;
          background: #f6e08a;
          color: #111;
          font-weight: 700;
        }
        #progress { position: absolute; z-index: 4; top: 0; left: 0; width: 100%; height: 8px; }
        #canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; background: #000; }
        [hidden] { display: none !important; }
      </style>
    </head>
    <body>
      <main id="disc-panel">
        <h1></h1>
        <p>Select your own English CD image. Local images are read directly and never uploaded.</p>
        <input id="disc-input" type="file" accept=".iso,application/x-iso9660-image">
        <label class="keep-copy"><input id="keep-copy" type="checkbox" checked> Keep a copy in this browser for next time</label>
        <div class="divider">or download an ISO</div>
        <label class="source-label" for="disc-url">CD image URL</label>
        <div class="url-row">
          <input id="disc-url" type="url" inputmode="url" placeholder="https://example.com/game.iso" spellcheck="false">
          <button id="download-disc" type="button">Download</button>
        </div>
        <button id="saved-copy" type="button" hidden>Play browser copy</button>
        <p id="message" role="status"></p>
      </main>
      <progress id="progress" max="100" value="0" hidden></progress>
      <div id="status" hidden></div>
      <canvas id="canvas" tabindex="0" oncontextmenu="event.preventDefault()"></canvas>
    </body>
  `;

  document.title = game.title;
  document.querySelector("h1").textContent = game.title;
  const panel = document.querySelector("#disc-panel");
  const discInput = document.querySelector("#disc-input");
  const discUrl = document.querySelector("#disc-url");
  const keepCopy = document.querySelector("#keep-copy");
  const downloadButton = document.querySelector("#download-disc");
  const savedCopyButton = document.querySelector("#saved-copy");
  const message = document.querySelector("#message");
  const statusElement = document.querySelector("#status");
  const progressElement = document.querySelector("#progress");
  const canvas = document.querySelector("#canvas");

  const setMessage = (value, isError = false) => {
    message.textContent = value;
    message.style.color = isError ? "#ff9d9d" : "#ffdf82";
  };

  const setControlsDisabled = (disabled) => {
    discInput.disabled = disabled;
    discUrl.disabled = disabled;
    downloadButton.disabled = disabled;
    savedCopyButton.disabled = disabled;
    keepCopy.disabled = disabled;
  };

  const formatBytes = (bytes) =>
    `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MiB`;

  const errorMessage = (error) =>
    error?.name === "QuotaExceededError"
      ? "The browser refused the storage write because its actual storage quota was reached."
      : error?.message || String(error);

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const requestUrl = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
      location.href,
    );
    if (
      !temporaryIso ||
      !temporaryGameFiles ||
      requestUrl.origin !== location.origin ||
      !requestUrl.pathname.startsWith(SCUMMVM_GAME_ROUTE)
    ) {
      return nativeFetch(input, init);
    }

    const requestedName = decodeURIComponent(
      requestUrl.pathname.slice(SCUMMVM_GAME_ROUTE.length),
    );
    if (requestedName === "index.json") {
      return Promise.resolve(
        new Response(
          JSON.stringify(
            Object.fromEntries(
              Object.entries(temporaryGameFiles).map(([name, entry]) => [
                name,
                entry.size,
              ]),
            ),
          ),
          {
            headers: {
              "Cache-Control": "no-store",
              "Content-Type": "application/json",
            },
          },
        ),
      );
    }

    const entry = temporaryGameFiles[requestedName.toUpperCase()];
    if (!entry) {
      return Promise.resolve(
        new Response("Game file not found", { status: 404 }),
      );
    }
    return Promise.resolve(
      new Response(
        temporaryIso.slice(entry.offset, entry.offset + entry.size),
        {
          headers: {
            "Cache-Control": "no-store",
            "Content-Length": String(entry.size),
            "Content-Type": "application/octet-stream",
          },
        },
      ),
    );
  };

  const readMetadata = () => {
    try {
      return JSON.parse(localStorage.getItem(metadataKey));
    } catch {
      return null;
    }
  };

  const getStorageDirectory = async (create = false) => {
    if (!navigator.storage?.getDirectory) {
      throw new Error(
        "Persistent browser storage is unavailable. Select a local ISO instead.",
      );
    }
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(STORAGE_DIRECTORY, { create });
  };

  const writeRuntimeManifest = async (directory, fileName, gameFiles) => {
    const handle = await directory.getFileHandle(runtimeManifestName, {
      create: true,
    });
    const writable = await handle.createWritable();
    await writable.write(
      JSON.stringify({
        version: 1,
        isoFile: fileName,
        isoSize: game.isoSize,
        files: Object.fromEntries(
          gameFiles.map(({ name, offset, size }) => [name, { offset, size }]),
        ),
      }),
    );
    await writable.close();
    const registration = await navigator.serviceWorker.ready;
    (navigator.serviceWorker.controller || registration.active)?.postMessage({
      type: "SCUMMVM_GAME_UPDATED",
      gameId: game.id,
    });
  };

  const notifyGameDataReady = (keep, fileName) => {
    window.parent.postMessage(
      {
        event: "astro.game-data-retention",
        gameId: game.shellId,
        storageId: `scummvm:${game.id}`,
        keep,
        fileName,
      },
      location.origin,
    );
    window.parent.postMessage(
      { event: "astro.game-data-changed" },
      location.origin,
    );
    window.parent.postMessage(
      { event: "astro.offline-game-ready", gameId: game.shellId },
      location.origin,
    );
  };

  const loadSavedIso = async () => {
    const metadata = readMetadata();
    if (!metadata?.fileName) return;
    try {
      const directory = await getStorageDirectory();
      const handle = await directory.getFileHandle(metadata.fileName);
      const iso = await handle.getFile();
      if (iso.size !== game.isoSize) {
        throw new Error("Saved CD image has the wrong size.");
      }
      savedIso = iso;
      discUrl.value = metadata.url || "";
      savedCopyButton.hidden = false;
      savedCopyButton.textContent = `Play browser copy (${formatBytes(iso.size)})`;
    } catch {
      localStorage.removeItem(metadataKey);
    }
  };

  const updateOutputVolume = () => {
    if (outputGain) outputGain.gain.value = currentVolume;
  };

  const connectOutputGain = () => {
    const sdl = window.Module?.SDL3;
    const node = sdl?.audio_playback?.scriptProcessorNode;
    if (!node || outputGain) return false;
    outputGain = sdl.audioContext.createGain();
    node.disconnect();
    node.connect(outputGain);
    outputGain.connect(sdl.audioContext.destination);
    updateOutputVolume();
    return true;
  };

  window.addEventListener("message", (event) => {
    if (
      event.origin !== window.location.origin ||
      event.data?.type !== "setVolume"
    ) {
      return;
    }
    currentVolume = Number.isFinite(event.data.volume)
      ? Math.min(1, Math.max(0, event.data.volume))
      : 0;
    updateOutputVolume();
  });

  const startScummVm = async () => {
    setControlsDisabled(true);
    setMessage("Starting ScummVM…");

    const gamePath = `/vendor/scummvm/2026.3.0/data/${game.id}`;
    const argumentsHash = encodeURI(`--path=${gamePath} ${game.scummvmId}`);
    history.replaceState(null, "", `${location.pathname}#${argumentsHash}`);
    panel.hidden = true;
    statusElement.hidden = false;

    window.Module = {
      canvas,
      print: (...values) => console.log(...values),
      printErr: (...values) => console.error(...values),
      setStatus(value) {
        const progress = value.match(/([^(]+)\((\d+(?:\.\d+)?)\/(\d+)\)/);
        if (progress) {
          statusElement.textContent = progress[1].trim();
          progressElement.value = Number(progress[2]);
          progressElement.max = Number(progress[3]);
          progressElement.hidden = false;
        } else {
          statusElement.textContent = value;
          statusElement.hidden = !value;
          progressElement.hidden = true;
        }
      },
      monitorRunDependencies(remaining) {
        this.totalDependencies = Math.max(
          this.totalDependencies || 0,
          remaining,
        );
        this.setStatus(
          remaining
            ? `Preparing… (${this.totalDependencies - remaining}/${this.totalDependencies})`
            : "Starting…",
        );
      },
      onRuntimeInitialized() {
        canvas.focus();
        const volumeTimer = window.setInterval(() => {
          if (connectOutputGain()) window.clearInterval(volumeTimer);
        }, 100);
      },
      onAbort(reason) {
        panel.hidden = false;
        setControlsDisabled(false);
        setMessage(`ScummVM could not start: ${reason}`, true);
      },
    };
    window.Module.setStatus("Downloading ScummVM…");

    const script = document.createElement("script");
    script.src = `${SCUMMVM_ROOT}scummvm.js`;
    script.onerror = () => {
      panel.hidden = false;
      setControlsDisabled(false);
      setMessage("The ScummVM runtime could not be loaded.", true);
    };
    document.body.append(script);
  };

  const activateStoredIso = async (
    directory,
    fileName,
    iso,
    gameFiles,
    { keep, url = "" },
  ) => {
    await writeRuntimeManifest(directory, fileName, gameFiles);
    if (keep) {
      const previous = readMetadata();
      localStorage.setItem(metadataKey, JSON.stringify({ fileName, url }));
      savedIso = iso;
      savedCopyButton.hidden = false;
      savedCopyButton.textContent = `Play browser copy (${formatBytes(iso.size)})`;
      if (previous?.fileName && previous.fileName !== fileName) {
        await directory.removeEntry(previous.fileName).catch(() => {});
      }
    }
    notifyGameDataReady(keep, fileName);
  };

  const activateTemporaryIso = (iso, gameFiles) => {
    temporaryIso = iso;
    temporaryGameFiles = Object.fromEntries(
      gameFiles.map(({ name, offset, size }) => [name, { offset, size }]),
    );
  };

  const storeIso = async (iso, gameFiles, { keep, url = "" }) => {
    if (iso.size !== game.isoSize) {
      throw new Error(
        `The CD image is ${formatBytes(iso.size)}, but this game requires ${formatBytes(game.isoSize)}.`,
      );
    }
    await navigator.storage.persist?.();
    const directory = await getStorageDirectory(true);
    const fileName = `${game.id}-${crypto.randomUUID()}.iso`;
    const handle = await directory.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    let copied = 0;
    try {
      const reader = iso.stream().getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        copied += value.byteLength;
        await writable.write(value);
        setMessage(
          `Saving browser copy… ${formatBytes(copied)} of ${formatBytes(game.isoSize)} (${((copied / game.isoSize) * 100).toFixed(1)}%)`,
        );
      }
      await writable.close();
    } catch (error) {
      await writable.abort().catch(() => {});
      await directory.removeEntry(fileName).catch(() => {});
      throw error;
    }
    const storedIso = await handle.getFile();
    await activateStoredIso(directory, fileName, storedIso, gameFiles, {
      keep,
      url,
    });
    return { fileName, iso: storedIso };
  };

  const prepareIso = async (iso, options) => {
    setControlsDisabled(true);
    setMessage("Checking CD image…");
    const gameFiles = await window.AstroIso9660.gameFilesFromIso(
      iso,
      game.requiredFiles,
      game.title,
    );
    if (options.keep) return storeIso(iso, gameFiles, options);
    activateTemporaryIso(iso, gameFiles);
    return { fileName: null, iso };
  };

  discInput.addEventListener("change", async () => {
    const [iso] = discInput.files;
    if (!iso) return;
    try {
      await prepareIso(iso, { keep: keepCopy.checked });
      setMessage(
        keepCopy.checked
          ? "Browser copy saved. Starting ScummVM…"
          : "Starting ScummVM…",
      );
      await startScummVm();
    } catch (error) {
      setControlsDisabled(false);
      setMessage(errorMessage(error), true);
      discInput.value = "";
    }
  });

  savedCopyButton.addEventListener("click", async () => {
    if (!savedIso) return;
    try {
      setControlsDisabled(true);
      setMessage("Checking browser copy…");
      const gameFiles = await window.AstroIso9660.gameFilesFromIso(
        savedIso,
        game.requiredFiles,
        game.title,
      );
      const metadata = readMetadata();
      const directory = await getStorageDirectory();
      await activateStoredIso(
        directory,
        metadata.fileName,
        savedIso,
        gameFiles,
        { keep: true, url: metadata.url || "" },
      );
      await startScummVm();
    } catch (error) {
      setControlsDisabled(false);
      setMessage(errorMessage(error), true);
    }
  });

  downloadButton.addEventListener("click", async () => {
    let url;
    try {
      url = new URL(discUrl.value.trim());
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("CD image URLs must use HTTP or HTTPS.");
      }
    } catch (error) {
      setMessage(
        error.message === "CD image URLs must use HTTP or HTTPS."
          ? error.message
          : "Enter a valid HTTP or HTTPS CD image URL.",
        true,
      );
      return;
    }

    let directory;
    let fileName;
    let writable;
    setControlsDisabled(true);
    try {
      setMessage("Connecting to CD image source…");
      let response;
      try {
        response = await fetch(url.href, { cache: "no-store" });
      } catch {
        throw new Error(
          "The CD image could not be downloaded. Check the URL and ensure its server allows cross-origin browser downloads (CORS).",
        );
      }
      if (!response.ok) {
        throw new Error(
          `The CD image server returned HTTP ${response.status}.`,
        );
      }
      if (!response.body) {
        throw new Error("This browser cannot stream the CD image download.");
      }

      const contentLength = Number(response.headers.get("Content-Length"));
      if (contentLength && contentLength !== game.isoSize) {
        throw new Error(
          `The remote file is ${formatBytes(contentLength)}, but this game requires ${formatBytes(game.isoSize)}.`,
        );
      }

      const reader = response.body.getReader();
      const chunks = [];
      let downloaded = 0;
      if (keepCopy.checked) {
        await navigator.storage.persist?.();
        directory = await getStorageDirectory(true);
        fileName = `${game.id}-${crypto.randomUUID()}.iso`;
        const handle = await directory.getFileHandle(fileName, {
          create: true,
        });
        writable = await handle.createWritable();
      }
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        downloaded += value.byteLength;
        if (downloaded > game.isoSize) {
          await reader.cancel();
          throw new Error(
            "The downloaded file is larger than the expected CD image.",
          );
        }
        if (writable) {
          await writable.write(value);
        } else {
          chunks.push(value);
        }
        setMessage(
          `Downloading… ${formatBytes(downloaded)} of ${formatBytes(game.isoSize)} (${((downloaded / game.isoSize) * 100).toFixed(1)}%)`,
        );
      }
      let iso;
      if (writable) {
        await writable.close();
        writable = null;
        iso = await (await directory.getFileHandle(fileName)).getFile();
      } else {
        iso = new Blob(chunks, { type: "application/x-iso9660-image" });
      }
      if (iso.size !== game.isoSize) {
        throw new Error(
          `The download is ${formatBytes(iso.size)}, but this game requires ${formatBytes(game.isoSize)}.`,
        );
      }
      setMessage("Checking downloaded CD image…");
      const gameFiles = await window.AstroIso9660.gameFilesFromIso(
        iso,
        game.requiredFiles,
        game.title,
      );
      if (keepCopy.checked) {
        await activateStoredIso(directory, fileName, iso, gameFiles, {
          keep: true,
          url: url.href,
        });
      } else {
        activateTemporaryIso(iso, gameFiles);
      }
      setMessage(
        keepCopy.checked
          ? "Download verified and saved. Starting ScummVM…"
          : "Download verified. Starting ScummVM…",
      );
      directory = null;
      fileName = null;
      await startScummVm();
    } catch (error) {
      if (writable) await writable.abort().catch(() => {});
      if (directory && fileName) {
        await directory.removeEntry(fileName).catch(() => {});
      }
      setControlsDisabled(false);
      setMessage(errorMessage(error), true);
    }
  });

  loadSavedIso();
})();
