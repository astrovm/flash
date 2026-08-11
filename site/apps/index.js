import { accessoryApplications } from "./catalog/accessories.js";
import { communicationApplications } from "./catalog/communications.js";
import { nativeGameApplications } from "./catalog/games.js";
import { systemToolApplications } from "./catalog/system-tools.js";
import { systemApplications } from "./catalog/system-applications.js";
import { createApplicationRegistry } from "./core/registry.js";
import { paintApplication } from "./paint/index.js";
import { notepadApplication } from "./notepad/index.js";
import { winampApplication } from "./winamp/index.js";
import { minesweeperApplication } from "./minesweeper/index.js";
import { solitaireApplication } from "./solitaire/index.js";

export const applicationRegistry = createApplicationRegistry([
  ...accessoryApplications,
  ...communicationApplications,
  ...systemToolApplications,
  ...nativeGameApplications,
  ...systemApplications,
  minesweeperApplication,
  notepadApplication,
  paintApplication,
  winampApplication,
  solitaireApplication,
]);

window.AstroShellApplications.install(applicationRegistry);
