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
  const { volume, isMuted } = getSystemVolume();
  const audio = new Audio(xpSoundPaths[name]);
  audio.volume = isMuted ? 0 : Math.min(Math.max(volume, 0), 100) / 100;
  return audio.play().then(
    () => true,
    () => false,
  );
};

let startupSoundPending = true;
let startupSoundBlocked = false;
let bootGeneration = 0;

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

const finishBootSequence = () => {
  bootGeneration++;
  clearTimeout(bootTimeout);
  if (!document.getElementById("boot-screen").hidden) showWelcomeScreen(true);
};

const showBootScreen = () => {
  const generation = ++bootGeneration;
  setSuspended(false);
  hideSystemDialogs();
  clearTimeout(shutdownTimeout);
  muteAllWindows();
  setScreen("boot-screen");
  const bootScreen = document.getElementById("boot-screen");
  bootScreen.classList.remove("boot-running", "boot-handoff");
  bootScreen.focus({ preventScroll: true });
  startupSoundPending = true;
  startupSoundBlocked = false;
  clearTimeout(bootTimeout);
  const isCurrentBoot = () =>
    generation === bootGeneration && !bootScreen.hidden;
  // Start the palette only once its original bitmaps are decoded. Slow asset
  // loading must not consume the animation while the screen is still blank.
  const imagesReady = Promise.allSettled(
    [...bootScreen.querySelectorAll("img")].map((image) => image.decode()),
  );
  const minimumDisplayComplete = imagesReady.then(() => {
    if (!isCurrentBoot()) return;
    bootScreen.classList.add("boot-running");
    return new Promise((resolve) => {
      bootTimeout = setTimeout(resolve, BOOT_MINIMUM_DURATION_MS);
    });
  });
  // XP advances when startup finishes; a browser's storage/runtime startup
  // takes a different amount of time from an emulated machine's disk I/O.
  void Promise.allSettled([
    minimumDisplayComplete,
    fs.ready,
    gameLibraryInitialization,
  ]).then(() => {
    if (!isCurrentBoot()) return;
    // Present the final palette even when storage was ready before the fade.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!isCurrentBoot()) return;
        bootScreen.classList.add("boot-handoff");
        // Paint the cleared framebuffer before entering the desktop mode.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (isCurrentBoot()) finishBootSequence();
          }),
        );
      }),
    );
  });
};

const showWelcomeScreen = (autoLogin = false) => {
  setSuspended(false);
  hideSystemDialogs();
  clearTimeout(bootTimeout);
  muteAllWindows();
  const welcomeScreen = document.getElementById("welcome-screen");
  const loginUser = document.getElementById("login-user");
  welcomeScreen.classList.toggle("auto-login", autoLogin);
  const status = document.getElementById("welcome-user-status");
  status.hidden = !loggedIn;
  const programCount = loggedIn ? openWindows.size : 0;
  status.classList.toggle("has-programs", programCount > 0);
  status.textContent = programCount
    ? `${programCount} program${programCount === 1 ? "" : "s"} running.`
    : "Logged on";
  if (autoLogin) {
    welcomeScreen.setAttribute("role", "button");
    welcomeScreen.setAttribute("tabindex", "0");
    welcomeScreen.setAttribute("aria-label", "Continue to the desktop");
  } else {
    welcomeScreen.removeAttribute("role");
    welcomeScreen.setAttribute("tabindex", "-1");
    welcomeScreen.removeAttribute("aria-label");
  }
  setScreen("welcome-screen");
  const focusTarget = autoLogin || !loggedIn ? welcomeScreen : loginUser;
  focusTarget.focus({ preventScroll: true });
  // Keyboard activation can finish after this handler moves focus.
  requestAnimationFrame(() => {
    if (!welcomeScreen.hidden) focusTarget.focus({ preventScroll: true });
  });
  if (startupSoundPending) {
    startupSoundPending = false;
    const generation = bootGeneration;
    void playXPSound("startup").then((played) => {
      if (generation === bootGeneration)
        startupSoundBlocked = !played && !welcomeScreen.hidden && autoLogin;
    });
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

let sessionClosePromise = null;
const closeCurrentSession = () => {
  if (sessionClosePromise) return sessionClosePromise;
  sessionClosePromise = (async () => {
    sessionGeneration++;
    const windows = [...openWindows.values()];
    for (const win of windows) {
      if (win.closePromise) {
        if ((await win.closePromise) === false) return false;
      } else if (win.beforeClose && (await win.beforeClose()) === false) {
        return false;
      }
    }
    for (const win of windows) {
      if (
        (await closeGameWindow(win.gameId, { skipBeforeClose: true })) === false
      )
        return false;
    }
    clearTimeout(screenSaverTimeout);
    const saver = document.getElementById("screen-saver-overlay");
    if (saver) hideScreenSaver(saver);
    showDesktopSnapshot = null;
    closeStartMenu();
    closeDesktopContextMenu();
    closeWindowSystemMenu();
    closeTaskbarMenus();
    closeTrayVolumePopup();
    focusedGameId = null;
    zIndexCounter = 100;
    cascadeCount = 0;
    loggedIn = false;
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search,
    );
    return true;
  })()
    .catch((error) => {
      void XPDialogs.alert(
        error.message || "The session could not be closed.",
        "Astro Flash",
        "error",
      );
      return false;
    })
    .finally(() => {
      sessionClosePromise = null;
    });
  return sessionClosePromise;
};

const logOff = async () => {
  hideSystemDialogs();
  if (!(await closeCurrentSession())) return;
  playXPSound("shutdown");
  showWelcomeScreen(false);
};

const switchUser = () => {
  // Fast User Switching leaves this session intact. The desktop is simply
  // hidden behind the logon screen until this user signs in again.
  playXPSound("logoff");
  showWelcomeScreen(false);
};

const restart = async () => {
  hideSystemDialogs();
  if (!(await closeCurrentSession())) return;
  startShutdown(true);
};

const turnOff = async () => {
  hideSystemDialogs();
  if (!(await closeCurrentSession())) return;
  startShutdown(false);
};

let loginPromise = null;
const login = (playSound = true) => {
  if (loginPromise) return loginPromise;
  startupSoundBlocked = false;
  const welcomeScreen = document.getElementById("welcome-screen");
  const loginUser = document.getElementById("login-user");
  const manualLogon = !welcomeScreen.classList.contains("auto-login");
  const logonSound = loggedIn ? "logon" : "startup";
  if (
    !welcomeScreen.hidden &&
    !welcomeScreen.classList.contains("auto-login")
  ) {
    welcomeScreen.classList.add("logging-in");
    welcomeScreen.setAttribute("aria-busy", "true");
    loginUser.disabled = true;
    const status = document.getElementById("welcome-user-status");
    status.classList.remove("has-programs");
    status.textContent = "Loading your personal settings...";
    status.hidden = false;
  }
  loginPromise = (async () => {
    await fs.ready;
    if (!shellInitialized) await syncGameFiles();
    clearTimeout(bootTimeout);
    loggedIn = true;
    showDesktop();
    applyDisplaySettings(getDisplaySettings());
    applyStartMenuStyle(getStartMenuStyle(), false);
    applyFocusVolumes();
    if (playSound && manualLogon) {
      playXPSound(logonSound);
    }

    if (!shellInitialized) {
      shellInitialized = true;
      buildDesktopIcons();
      buildPlaces();
      setupSearch();
      setupScreenSaver();
      startClock();

      // Deep link: #game-id opens that game's window
      const gameId = getHashGameId();
      if (gameId) {
        openLinkedGame(gameId);
      }
    }
    scheduleScreenSaver();
  })().finally(() => {
    welcomeScreen.classList.remove("logging-in");
    welcomeScreen.removeAttribute("aria-busy");
    loginUser.disabled = false;
    loginPromise = null;
  });
  return loginPromise;
};

const continueWelcomeFromInput = () => {
  if (startupSoundBlocked) {
    startupSoundBlocked = false;
    void playXPSound("startup");
  }
  return login();
};

const setupScreenFlow = () => {
  const bootScreen = document.getElementById("boot-screen");
  bootScreen.addEventListener("click", finishBootSequence);
  bootScreen.addEventListener("keydown", (event) => {
    if (!["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    finishBootSequence();
  });
  // Hide BoxedWine preparation behind the normal boot and Welcome screens.
  // Do not make either screen wait when the browser needs more time.
  document
    .getElementById("welcome-screen")
    .addEventListener("click", (event) => {
      if (event.target.closest("#welcome-turn-off, #welcome-user-status"))
        return;
      if (
        event.currentTarget.classList.contains("auto-login") ||
        event.target.closest("#login-user")
      )
        continueWelcomeFromInput();
    });
  document
    .getElementById("welcome-screen")
    .addEventListener("keydown", (event) => {
      if (
        !event.currentTarget.classList.contains("auto-login") ||
        event.target !== event.currentTarget ||
        !["Enter", " "].includes(event.key)
      ) {
        return;
      }
      event.preventDefault();
      continueWelcomeFromInput();
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
