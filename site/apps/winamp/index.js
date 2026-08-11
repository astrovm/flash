import { defineApplication } from "../core/application.js";

const AUDIO_TYPES = [
  ".aac",
  ".flac",
  ".m4a",
  ".mp3",
  ".oga",
  ".ogg",
  ".opus",
  ".wav",
  ".webm",
];
const PLAYLIST_TYPES = [".m3u", ".m3u8", ".pls"];
const FILE_TYPES = [...AUDIO_TYPES, ...PLAYLIST_TYPES];
const EQ_FREQUENCIES = [
  60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000,
];

const decodeText = (content) => {
  if (!String(content).startsWith("data:")) return String(content || "");
  const [header, body = ""] = String(content).split(",", 2);
  try {
    return header.includes(";base64") ? atob(body) : decodeURIComponent(body);
  } catch {
    return "";
  }
};

const formatTime = (seconds) => {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
};

const trackTitle = (node) => node.name.replace(/\.[^.]+$/, "");

const mountWinamp = (shell, instance) => {
  const root = document.createElement("div");
  root.className = "winamp-app stopped";
  root.setAttribute("aria-label", "Winamp 2.91");
  root.innerHTML = `
    <audio class="winamp-audio" preload="metadata"></audio>
    <section class="winamp-panel winamp-main" aria-label="Winamp main window">
      <div class="title-bar winamp-title-bar">
        <span class="title-icon" aria-hidden="true"></span>
        <span class="title-buttons">
          <button class="winamp-sprite winamp-options" type="button" aria-label="Winamp menu"></button>
          <button class="winamp-sprite winamp-minimize minimize-btn" type="button" aria-label="Minimize"></button>
          <button class="winamp-sprite winamp-shade" type="button" aria-label="Windowshade mode"></button>
          <button class="winamp-sprite winamp-close close-btn" type="button" aria-label="Close"></button>
        </span>
      </div>
      <div class="winamp-menu" hidden>
        <button type="button" data-winamp-menu="about">About Winamp...</button>
        <button type="button" data-winamp-menu="file-info">View file info...</button>
        <button type="button" data-winamp-menu="preferences">Preferences...</button>
      </div>
      <span class="winamp-sprite winamp-state" aria-hidden="true"></span>
      <div class="winamp-time" aria-label="Elapsed time">
        <span data-digit="0"></span><span data-digit="0"></span><i></i><span data-digit="0"></span><span data-digit="0"></span>
      </div>
      <div class="winamp-visualizer" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="winamp-marquee">WINAMP 2.91</div>
      <span class="winamp-kbps">128</span><span class="winamp-khz">44</span>
      <span class="winamp-sprite winamp-stereo" aria-label="Stereo"></span>
      <label class="winamp-slider winamp-volume" aria-label="Volume"><input type="range" min="0" max="100" value="75"></label>
      <label class="winamp-slider winamp-balance" aria-label="Balance"><input type="range" min="-1" max="1" step="0.01" value="0"></label>
      <button class="winamp-sprite winamp-eq-toggle selected" type="button" aria-pressed="true" aria-label="Toggle equalizer"></button>
      <button class="winamp-sprite winamp-playlist-toggle selected" type="button" aria-pressed="true" aria-label="Toggle playlist"></button>
      <input class="winamp-position" aria-label="Seek" type="range" min="0" max="1000" value="0">
      <div class="winamp-actions">
        <button class="winamp-sprite previous" type="button" aria-label="Previous track"></button>
        <button class="winamp-sprite play" type="button" aria-label="Play"></button>
        <button class="winamp-sprite pause" type="button" aria-label="Pause"></button>
        <button class="winamp-sprite stop" type="button" aria-label="Stop"></button>
        <button class="winamp-sprite next" type="button" aria-label="Next track"></button>
      </div>
      <button class="winamp-sprite winamp-eject" type="button" aria-label="Open file"></button>
      <button class="winamp-sprite winamp-shuffle" type="button" aria-pressed="false" aria-label="Shuffle"></button>
      <button class="winamp-sprite winamp-repeat" type="button" aria-pressed="false" aria-label="Repeat"></button>
    </section>
    <section class="winamp-panel winamp-equalizer" aria-label="Winamp equalizer">
      <button class="winamp-sprite winamp-eq-close" type="button" aria-label="Close equalizer"></button>
      <button class="winamp-sprite winamp-eq-on selected" type="button" aria-pressed="true" aria-label="Enable equalizer"></button>
      <button class="winamp-sprite winamp-eq-auto" type="button" aria-pressed="false" aria-label="Auto equalizer"></button>
      <div class="winamp-eq-sliders">
        <label><span>Preamp</span><input data-eq="preamp" type="range" min="-12" max="12" step="1" value="0" aria-label="Preamp"></label>
        ${EQ_FREQUENCIES.map((frequency) => `<label><span>${frequency}</span><input data-eq="${frequency}" type="range" min="-12" max="12" step="1" value="0" aria-label="${frequency} Hz"></label>`).join("")}
      </div>
    </section>
    <section class="winamp-panel winamp-playlist" aria-label="Winamp playlist editor">
      <div class="winamp-playlist-top" aria-hidden="true"><i></i><b></b><span></span><em></em><strong></strong></div>
      <button class="winamp-sprite winamp-playlist-close" type="button" aria-label="Close playlist"></button>
      <div class="winamp-playlist-body"><i class="winamp-playlist-edge left" aria-hidden="true"><b></b><b></b></i><ol aria-label="Playlist"></ol><i class="winamp-playlist-edge right" aria-hidden="true"><b></b><b></b></i></div>
      <div class="winamp-playlist-bottom" aria-hidden="true"><i></i><b></b><span></span></div>
      <button class="winamp-sprite winamp-add" type="button" aria-label="Add file"></button>
      <button class="winamp-sprite winamp-remove" type="button" aria-label="Remove selected track"></button>
      <button class="winamp-sprite winamp-new-list" type="button" aria-label="New playlist"></button>
      <output class="winamp-playlist-time">0:00</output>
    </section>`;

  instance.window.el.querySelector(":scope > .title-bar")?.remove();
  const audio = root.querySelector("audio");
  const playlist = root.querySelector(".winamp-playlist ol");
  const seek = root.querySelector(".winamp-position");
  const marquee = root.querySelector(".winamp-marquee");
  const timeDigits = [...root.querySelectorAll(".winamp-time span")];
  let tracks = [];
  let activeIndex = -1;
  let selectedIndex = -1;
  let shuffle = false;
  let repeat = false;
  let eqEnabled = true;
  let audioGraph = null;

  const updateTime = () => {
    const seconds = audio.currentTime || 0;
    const compact = formatTime(seconds)
      .replace(":", "")
      .padStart(4, "0")
      .slice(-4);
    timeDigits.forEach((digit, index) => {
      digit.dataset.digit = compact[index];
      digit.style.backgroundPositionX = `${-Number(compact[index]) * 9}px`;
    });
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (duration && document.activeElement !== seek)
      seek.value = String(Math.round((seconds / duration) * 1000));
    root.querySelector(".winamp-playlist-time").value = formatTime(seconds);
  };

  const updatePlaylist = () => {
    playlist.replaceChildren(
      ...tracks.map((track, index) => {
        const item = document.createElement("li");
        item.dataset.trackIndex = String(index);
        item.classList.toggle("active", index === activeIndex);
        item.classList.toggle("selected", index === selectedIndex);
        const title = document.createElement("span");
        title.textContent = `${index + 1}. ${track.title}`;
        const duration = document.createElement("time");
        duration.textContent = track.duration ? formatTime(track.duration) : "";
        item.append(title, duration);
        return item;
      }),
    );
  };

  const ensureAudioGraph = () => {
    if (audioGraph || !window.AudioContext) return audioGraph;
    try {
      const context = new AudioContext();
      const source = context.createMediaElementSource(audio);
      const preamp = context.createGain();
      const filters = EQ_FREQUENCIES.map((frequency) => {
        const filter = context.createBiquadFilter();
        filter.type = "peaking";
        filter.frequency.value = frequency;
        filter.Q.value = 1.4;
        return filter;
      });
      const panner = context.createStereoPanner();
      [source, preamp, ...filters, panner, context.destination].reduce(
        (previous, node) => {
          previous.connect(node);
          return node;
        },
      );
      audioGraph = { context, preamp, filters, panner };
    } catch {
      audioGraph = null;
    }
    return audioGraph;
  };

  const setPlaybackState = (state) => {
    root.classList.remove("playing", "paused", "stopped");
    root.classList.add(state);
  };

  const play = async () => {
    if (activeIndex < 0 && tracks.length) activeIndex = 0;
    if (activeIndex < 0) return;
    if (!audio.src) audio.src = tracks[activeIndex].url;
    setPlaybackState("playing");
    updatePlaylist();
    try {
      await audio.play();
    } catch {
      setPlaybackState("stopped");
    }
  };

  const loadTrack = (index, autoplay = false) => {
    if (!tracks[index]) return false;
    activeIndex = index;
    selectedIndex = index;
    audio.src = tracks[index].url;
    audio.load?.();
    marquee.textContent = `${index + 1}. ${tracks[index].title}`.toUpperCase();
    shell.setTitle(`${tracks[index].title} - Winamp`);
    seek.value = "0";
    updatePlaylist();
    if (autoplay) play();
    return true;
  };

  const nextIndex = (direction) => {
    if (!tracks.length) return -1;
    if (shuffle && tracks.length > 1) {
      let candidate = activeIndex;
      while (candidate === activeIndex)
        candidate = Math.floor(Math.random() * tracks.length);
      return candidate;
    }
    return (activeIndex + direction + tracks.length) % tracks.length;
  };

  const addAudioNode = (node, autoplay = false) => {
    if (!node || !AUDIO_TYPES.includes(String(node.ext).toLowerCase()))
      return false;
    const duplicate = tracks.findIndex((track) => track.node.id === node.id);
    if (duplicate >= 0) return loadTrack(duplicate, autoplay);
    tracks.push({
      node,
      title: trackTitle(node),
      url: node.content || "",
      duration: 0,
    });
    updatePlaylist();
    return loadTrack(tracks.length - 1, autoplay);
  };

  const playlistNodes = (node) => {
    const text = decodeText(node.content);
    const isPls = String(node.ext).toLowerCase() === ".pls";
    const lines = text.split(/\r?\n/).map((line) => line.trim());
    const entries = isPls
      ? lines
          .filter((line) => /^file\d+=/i.test(line))
          .map((line) => line.slice(line.indexOf("=") + 1))
      : lines.filter((line) => line && !line.startsWith("#"));
    const parentPath = shell.fs.getPath(node.parent) || "";
    return entries
      .map((entry) => {
        const path = /^[a-z]:[\\/]/i.test(entry)
          ? entry
          : `${parentPath}\\${entry}`;
        const id = shell.fs.resolvePath(path);
        return id ? shell.fs.getNode(id) : null;
      })
      .filter(Boolean);
  };

  const openNode = (node, autoplay = true) => {
    if (PLAYLIST_TYPES.includes(String(node?.ext).toLowerCase())) {
      const nodes = playlistNodes(node);
      tracks = [];
      nodes.forEach((entry) => addAudioNode(entry, false));
      if (tracks.length) loadTrack(0, autoplay);
      return tracks.length > 0;
    }
    return addAudioNode(node, autoplay);
  };

  const chooseFile = async () => {
    const node = await shell.openFile({
      title: "Open file(s)",
      filter: FILE_TYPES,
    });
    if (node) openNode(node, true);
  };

  root
    .querySelector(".winamp-minimize")
    .addEventListener("click", shell.minimize);
  root.querySelector(".winamp-close").addEventListener("click", shell.close);
  root
    .querySelector(".winamp-shade")
    .addEventListener("click", () => root.classList.toggle("windowshade"));
  root.querySelector(".winamp-options").addEventListener("click", () => {
    const menu = root.querySelector(".winamp-menu");
    menu.hidden = !menu.hidden;
  });
  root.querySelector(".winamp-menu").addEventListener("click", (event) => {
    const command = event.target.closest("button")?.dataset.winampMenu;
    root.querySelector(".winamp-menu").hidden = true;
    if (command === "about")
      shell.showMessage("About Winamp", "Winamp 2.91\nFirst-party web edition");
    else if (command === "file-info")
      shell.showMessage(
        "File Info",
        tracks[activeIndex]?.node.name || "No file loaded.",
      );
    else if (command === "preferences")
      shell.showMessage(
        "Winamp Preferences",
        "Playback uses your browser audio device.",
      );
  });
  root.querySelector(".winamp-actions .play").addEventListener("click", play);
  root.querySelector(".winamp-actions .pause").addEventListener("click", () => {
    audio.pause();
    setPlaybackState("paused");
  });
  root.querySelector(".winamp-actions .stop").addEventListener("click", () => {
    audio.pause();
    audio.currentTime = 0;
    setPlaybackState("stopped");
    updateTime();
  });
  root
    .querySelector(".winamp-actions .next")
    .addEventListener("click", () => loadTrack(nextIndex(1), true));
  root
    .querySelector(".winamp-actions .previous")
    .addEventListener("click", () => loadTrack(nextIndex(-1), true));
  root
    .querySelectorAll(".winamp-eject, .winamp-add")
    .forEach((button) => button.addEventListener("click", chooseFile));
  root.querySelector(".winamp-shuffle").addEventListener("click", (event) => {
    shuffle = !shuffle;
    event.currentTarget.classList.toggle("selected", shuffle);
    event.currentTarget.setAttribute("aria-pressed", String(shuffle));
  });
  root.querySelector(".winamp-repeat").addEventListener("click", (event) => {
    repeat = !repeat;
    event.currentTarget.classList.toggle("selected", repeat);
    event.currentTarget.setAttribute("aria-pressed", String(repeat));
  });
  root.querySelector(".winamp-eq-toggle").addEventListener("click", (event) => {
    const panel = root.querySelector(".winamp-equalizer");
    panel.hidden = !panel.hidden;
    event.currentTarget.classList.toggle("selected", !panel.hidden);
    event.currentTarget.setAttribute("aria-pressed", String(!panel.hidden));
    root.classList.toggle("equalizer-hidden", panel.hidden);
  });
  root
    .querySelector(".winamp-playlist-toggle")
    .addEventListener("click", (event) => {
      const panel = root.querySelector(".winamp-playlist");
      panel.hidden = !panel.hidden;
      event.currentTarget.classList.toggle("selected", !panel.hidden);
      event.currentTarget.setAttribute("aria-pressed", String(!panel.hidden));
      root.classList.toggle("playlist-hidden", panel.hidden);
    });
  root
    .querySelector(".winamp-eq-close")
    .addEventListener("click", () =>
      root.querySelector(".winamp-eq-toggle").click(),
    );
  root
    .querySelector(".winamp-playlist-close")
    .addEventListener("click", () =>
      root.querySelector(".winamp-playlist-toggle").click(),
    );
  root
    .querySelector(".winamp-volume input")
    .addEventListener("input", (event) => {
      audio.volume = Number(event.target.value) / 100;
    });
  root
    .querySelector(".winamp-balance input")
    .addEventListener("input", (event) => {
      const graph = ensureAudioGraph();
      if (graph) graph.panner.pan.value = Number(event.target.value);
    });
  seek.addEventListener("input", () => {
    if (Number.isFinite(audio.duration))
      audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
    updateTime();
  });
  root.querySelector(".winamp-eq-on").addEventListener("click", (event) => {
    eqEnabled = !eqEnabled;
    event.currentTarget.classList.toggle("selected", eqEnabled);
    event.currentTarget.setAttribute("aria-pressed", String(eqEnabled));
    root
      .querySelectorAll("[data-eq]")
      .forEach((slider) => slider.dispatchEvent(new Event("input")));
  });
  root.querySelectorAll("[data-eq]").forEach((slider) =>
    slider.addEventListener("input", (event) => {
      const graph = ensureAudioGraph();
      if (!graph) return;
      const gain = eqEnabled ? Number(event.target.value) : 0;
      if (event.target.dataset.eq === "preamp")
        graph.preamp.gain.value = 10 ** (gain / 20);
      else
        graph.filters[
          EQ_FREQUENCIES.indexOf(Number(event.target.dataset.eq))
        ].gain.value = gain;
    }),
  );
  playlist.addEventListener("click", (event) => {
    const item = event.target.closest("li");
    if (!item) return;
    selectedIndex = Number(item.dataset.trackIndex);
    updatePlaylist();
  });
  playlist.addEventListener("dblclick", (event) => {
    const item = event.target.closest("li");
    if (item) loadTrack(Number(item.dataset.trackIndex), true);
  });
  root.querySelector(".winamp-remove").addEventListener("click", () => {
    if (!tracks[selectedIndex]) return;
    const removingActive = selectedIndex === activeIndex;
    tracks.splice(selectedIndex, 1);
    selectedIndex = Math.min(selectedIndex, tracks.length - 1);
    if (removingActive) {
      audio.pause();
      audio.removeAttribute("src");
      activeIndex = -1;
      setPlaybackState("stopped");
      if (tracks.length) loadTrack(Math.max(0, selectedIndex), false);
    } else if (selectedIndex < activeIndex) activeIndex -= 1;
    updatePlaylist();
  });
  root.querySelector(".winamp-new-list").addEventListener("click", () => {
    audio.pause();
    audio.removeAttribute("src");
    tracks = [];
    activeIndex = -1;
    selectedIndex = -1;
    marquee.textContent = "WINAMP 2.91";
    shell.setTitle("Winamp");
    setPlaybackState("stopped");
    updatePlaylist();
  });
  audio.addEventListener("timeupdate", updateTime);
  audio.addEventListener("loadedmetadata", () => {
    if (tracks[activeIndex]) tracks[activeIndex].duration = audio.duration;
    updatePlaylist();
    updateTime();
  });
  audio.addEventListener("ended", () => {
    if (repeat) {
      audio.currentTime = 0;
      play();
    } else if (tracks.length > 1) loadTrack(nextIndex(1), true);
    else setPlaybackState("stopped");
  });

  if (instance.file) openNode(instance.file, true);
  return {
    element: root,
    openFile: openNode,
    unmount() {
      audio.pause();
      audioGraph?.context.close();
    },
  };
};

export const winampApplication = defineApplication({
  id: "__winamp",
  title: "Winamp",
  icon: "apps/winamp/icon.png",
  kind: "winamp",
  fileTypes: FILE_TYPES,
  window: {
    width: 275,
    height: 348,
    className: "xp-native-winamp-window",
    customChrome: true,
  },
  mount: mountWinamp,
});
