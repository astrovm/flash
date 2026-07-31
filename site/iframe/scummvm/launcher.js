"use strict";

(() => {
  const game = window.PINK_GAME;
  if (!game) throw new Error("Missing Pink Panther game configuration.");

  const SCUMMVM_ROOT = "../../vendor/scummvm/2026.3.0/";
  const STORAGE_DIRECTORY = "astro-flash-scummvm";
  const metadataKey = `astro-flash.scummvm.${game.id}.iso.v1`;
  let currentVolume = 1;
  let outputGain = null;
  let savedIso = null;

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
        <p>Use your authorized English CD image. Downloads are saved only in this browser; local images are read directly and never uploaded.</p>
        <label class="source-label" for="disc-url">CD image URL</label>
        <div class="url-row">
          <input id="disc-url" type="url" inputmode="url" placeholder="https://example.com/game.iso" spellcheck="false">
          <button id="download-disc" type="button">Download</button>
        </div>
        <button id="saved-copy" type="button" hidden>Play downloaded copy</button>
        <div class="divider">or select a local ISO</div>
        <input id="disc-input" type="file" accept=".iso,application/x-iso9660-image">
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
  };

  const formatBytes = (bytes) =>
    `${(bytes / 1024 / 1024).toFixed(bytes >= 100 * 1024 * 1024 ? 0 : 1)} MiB`;

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
      savedCopyButton.textContent = `Play downloaded copy (${formatBytes(iso.size)})`;
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

  const startScummVm = async (iso) => {
    setControlsDisabled(true);
    setMessage("Checking CD image…");
    const blobs = await window.AstroIso9660.gameBlobsFromIso(
      iso,
      game.requiredFiles,
      game.title,
    );
    setMessage("Starting ScummVM…");

    const argumentsHash = encodeURI(
      `--path=/games/${game.id} ${game.scummvmId}`,
    );
    history.replaceState(null, "", `${location.pathname}#${argumentsHash}`);
    panel.hidden = true;
    statusElement.hidden = false;

    window.Module = {
      canvas,
      preRun: [
        () => {
          window.FS.mkdirTree(`/games/${game.id}`);
          window.FS.mount(window.WORKERFS, { blobs }, `/games/${game.id}`);
        },
      ],
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

  discInput.addEventListener("change", async () => {
    const [iso] = discInput.files;
    if (!iso) return;
    try {
      await startScummVm(iso);
    } catch (error) {
      setControlsDisabled(false);
      setMessage(error.message, true);
      discInput.value = "";
    }
  });

  savedCopyButton.addEventListener("click", async () => {
    if (!savedIso) return;
    try {
      await startScummVm(savedIso);
    } catch (error) {
      setControlsDisabled(false);
      setMessage(error.message, true);
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
      await navigator.storage.persist?.();
      const estimate = await navigator.storage.estimate();
      const available = (estimate.quota || 0) - (estimate.usage || 0);
      if (estimate.quota && available < game.isoSize) {
        throw new Error(
          `Not enough browser storage. ${formatBytes(game.isoSize)} is required and ${formatBytes(available)} is available.`,
        );
      }

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

      directory = await getStorageDirectory(true);
      fileName = `${game.id}-${crypto.randomUUID()}.iso`;
      const handle = await directory.getFileHandle(fileName, { create: true });
      writable = await handle.createWritable();
      const reader = response.body.getReader();
      let downloaded = 0;
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
        await writable.write(value);
        setMessage(
          `Downloading… ${formatBytes(downloaded)} of ${formatBytes(game.isoSize)} (${((downloaded / game.isoSize) * 100).toFixed(1)}%)`,
        );
      }
      await writable.close();
      writable = null;

      const iso = await handle.getFile();
      if (iso.size !== game.isoSize) {
        throw new Error(
          `The download is ${formatBytes(iso.size)}, but this game requires ${formatBytes(game.isoSize)}.`,
        );
      }
      setMessage("Checking downloaded CD image…");
      await window.AstroIso9660.gameBlobsFromIso(
        iso,
        game.requiredFiles,
        game.title,
      );

      const previous = readMetadata();
      localStorage.setItem(
        metadataKey,
        JSON.stringify({ fileName, url: url.href }),
      );
      savedIso = iso;
      savedCopyButton.hidden = false;
      savedCopyButton.textContent = `Play downloaded copy (${formatBytes(iso.size)})`;
      if (previous?.fileName && previous.fileName !== fileName) {
        directory.removeEntry(previous.fileName).catch(() => {});
      }
      setMessage("Download verified and saved. Starting ScummVM…");
      directory = null;
      fileName = null;
      await startScummVm(iso);
    } catch (error) {
      if (writable) await writable.abort().catch(() => {});
      if (directory && fileName) {
        await directory.removeEntry(fileName).catch(() => {});
      }
      setControlsDisabled(false);
      setMessage(error.message, true);
    }
  });

  loadSavedIso();
})();
