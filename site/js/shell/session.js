"use strict";

// ============================================
// Screen Flow (boot -> welcome -> desktop)
// ============================================

// Original Windows XP system sounds (playback is skipped if the
// browser still blocks audio before the user's first interaction)
const xpSoundPaths = {
  error: "assets/xp/sounds/error.wav",
  logoff: "assets/xp/sounds/logoff.wav",
  logon: "assets/xp/sounds/logon.wav",
  shutdown: "assets/xp/sounds/shutdown.wav",
  startup: "assets/xp/sounds/startup.wav",
};

const playXPSound = (name) => {
  const { volume, isMuted } = getMasterVolume();
  const audio = new Audio(xpSoundPaths[name]);
  audio.volume = isMuted ? 0 : Math.min(Math.max(volume, 0), 100) / 100;
  audio.play().catch(() => {});
};

let startupSoundPending = true;

const setScreen = (...visibleIds) => {
  [
    "boot-screen",
    "welcome-screen",
    "desktop",
    "taskbar",
    "shutdown-screen",
    "turn-off-screen",
  ].forEach((id) => {
    document.getElementById(id).hidden = !visibleIds.includes(id);
  });
};

const setSuspended = (value) => {
  suspended = value;
  const standbyScreen = document.getElementById("standby-screen");
  standbyScreen.hidden = !value;

  if (value) {
    closeStartMenu();
    closeDesktopContextMenu();
    closeWindowSystemMenu();
    closeTaskbarMenus();
    closeTrayVolumePopup();
    muteAllWindows();
    document.getElementById("standby-resume").focus();
  } else if (loggedIn) {
    applyFocusVolumes();
  }
};

const hideSystemDialogs = () => {
  document.getElementById("logoff-dialog").hidden = true;
  document.getElementById("shutdown-dialog").hidden = true;
};

const showLogoffDialog = () => {
  closeStartMenu();
  document.getElementById("logoff-dialog").hidden = false;
};

const showShutdownDialog = () => {
  closeStartMenu();
  document.getElementById("shutdown-dialog").hidden = false;
};

const muteAllWindows = () => {
  openWindows.forEach((win) => setPlayerVolume(win.player, win.type, 0));
};

const showBootScreen = () => {
  setSuspended(false);
  hideSystemDialogs();
  clearTimeout(shutdownTimeout);
  muteAllWindows();
  setScreen("boot-screen");
  document.getElementById("boot-screen").focus({ preventScroll: true });
  startupSoundPending = true;
  clearTimeout(bootTimeout);
  bootTimeout = setTimeout(() => showWelcomeScreen(true), BOOT_DURATION_MS);
};

const showWelcomeScreen = (autoLogin = false) => {
  setSuspended(false);
  hideSystemDialogs();
  clearTimeout(bootTimeout);
  muteAllWindows();
  const welcomeScreen = document.getElementById("welcome-screen");
  const loginUser = document.getElementById("login-user");
  welcomeScreen.classList.toggle("auto-login", autoLogin);
  if (autoLogin) {
    welcomeScreen.setAttribute("role", "button");
    welcomeScreen.setAttribute("tabindex", "0");
    welcomeScreen.setAttribute("aria-label", "Continue to the desktop");
  } else {
    welcomeScreen.removeAttribute("role");
    welcomeScreen.removeAttribute("tabindex");
    welcomeScreen.removeAttribute("aria-label");
  }
  setScreen("welcome-screen");
  const focusTarget = autoLogin ? welcomeScreen : loginUser;
  focusTarget.focus({ preventScroll: true });
  // Keyboard activation can finish after this handler moves focus.
  requestAnimationFrame(() => {
    if (!welcomeScreen.hidden) focusTarget.focus({ preventScroll: true });
  });
  if (startupSoundPending) {
    startupSoundPending = false;
    playXPSound("startup");
  }
  if (autoLogin) {
    bootTimeout = setTimeout(() => login(), WELCOME_DURATION_MS);
  }
};

const showDesktop = () => {
  setScreen("desktop", "taskbar");
  closeStartMenu();
};

const showTurnOffScreen = () => {
  muteAllWindows();
  setScreen("turn-off-screen");
};

const startShutdown = (restart = false) => {
  setSuspended(false);
  hideSystemDialogs();
  muteAllWindows();
  playXPSound("shutdown");
  setScreen("shutdown-screen");
  clearTimeout(shutdownTimeout);
  shutdownTimeout = setTimeout(
    restart ? showBootScreen : showTurnOffScreen,
    1800,
  );
};

const closeCurrentSession = () => {
  clearTimeout(screenSaverTimeout);
  const saver = document.getElementById("screen-saver-overlay");
  if (saver) saver.hidden = true;
  showDesktopSnapshot = null;
  closeStartMenu();
  closeDesktopContextMenu();
  closeWindowSystemMenu();
  closeTaskbarMenus();
  closeTrayVolumePopup();
  Array.from(openWindows.keys()).forEach(closeGameWindow);
  focusedGameId = null;
  zIndexCounter = 100;
  cascadeCount = 0;
  loggedIn = false;
  history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
};

const logOff = () => {
  closeCurrentSession();
  playXPSound("logoff");
  showWelcomeScreen(false);
};

const switchUser = () => {
  // Fast User Switching leaves this session intact. The desktop is simply
  // hidden behind the logon screen until this user signs in again.
  playXPSound("logoff");
  showWelcomeScreen(false);
};

const restart = () => {
  closeCurrentSession();
  startShutdown(true);
};

const turnOff = () => {
  closeCurrentSession();
  startShutdown(false);
};

let loginPromise = null;
const login = (playSound = true) => {
  if (loginPromise) return loginPromise;
  loginPromise = (async () => {
    await gameLibraryInitialization;
    clearTimeout(bootTimeout);
    loggedIn = true;
    showDesktop();
    applyDisplaySettings(getDisplaySettings());
    applyStartMenuStyle(getStartMenuStyle(), false);
    applyFocusVolumes();
    if (playSound) {
      playXPSound("logon");
    }

    networkConnectedAt = Date.now();
    if (!shellInitialized) {
      shellInitialized = true;
      syncGameFiles();
      buildDesktopIcons();
      buildPlaces();
      setupSearch();
      setupScreenSaver();
      startClock();

      // Deep link: #game-id opens that game's window
      const gameId = getHashGameId();
      if (gameId) {
        openGameWindow(gameId);
      }
    }
    maybePromptForUpdate(offlineManager.getSnapshot());
    scheduleScreenSaver();
  })().finally(() => {
    loginPromise = null;
  });
  return loginPromise;
};

const setupScreenFlow = () => {
  const bootScreen = document.getElementById("boot-screen");
  const skipBootScreen = () => showWelcomeScreen(true);
  bootScreen.addEventListener("click", skipBootScreen);
  bootScreen.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    skipBootScreen();
  });
  document
    .getElementById("welcome-screen")
    .addEventListener("click", (event) => {
      if (event.target.closest("#welcome-turn-off")) return;
      login();
    });
  document
    .getElementById("welcome-screen")
    .addEventListener("keydown", (event) => {
      if (
        event.target !== event.currentTarget ||
        !["Enter", " "].includes(event.key)
      ) {
        return;
      }
      event.preventDefault();
      login();
    });
  document
    .getElementById("turn-off-screen")
    .addEventListener("click", showBootScreen);

  document.getElementById("welcome-turn-off").addEventListener("click", () => {
    showShutdownDialog();
  });

  document.getElementById("log-off-button").addEventListener("click", () => {
    showLogoffDialog();
  });

  document.getElementById("turn-off-button").addEventListener("click", () => {
    showShutdownDialog();
  });

  document
    .getElementById("logoff-cancel")
    .addEventListener("click", hideSystemDialogs);
  document
    .getElementById("shutdown-cancel")
    .addEventListener("click", hideSystemDialogs);
  document
    .getElementById("switch-user-confirm")
    .addEventListener("click", switchUser);
  document.getElementById("logoff-confirm").addEventListener("click", logOff);
  document
    .getElementById("shutdown-confirm")
    .addEventListener("click", turnOff);
  document.getElementById("restart-confirm").addEventListener("click", restart);
  document.getElementById("standby-confirm").addEventListener("click", () => {
    hideSystemDialogs();
    setSuspended(true);
  });
  document
    .getElementById("standby-resume")
    .addEventListener("click", () => setSuspended(false));
  document
    .getElementById("standby-screen")
    .addEventListener("pointerdown", () => setSuspended(false));

  if (getHashGameId()) {
    startupSoundPending = false;
    login(false);
  } else {
    showBootScreen();
  }
};
