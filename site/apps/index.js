import { accessoryApplications } from "./catalog/accessories.js";
import { systemToolApplications } from "./catalog/system-tools.js";
import { systemApplications } from "./catalog/system-applications.js";
import { createApplicationRegistry } from "./core/registry.js";
import { paintApplication } from "./paint/index.js";
import { notepadApplication } from "./notepad/index.js";
import { winampApplication } from "./winamp/index.js";
import { minesweeperApplication } from "./minesweeper/index.js";
import { solitaireApplication } from "./solitaire/index.js";
import { pinballApplication } from "./pinball/index.js";

export const applicationRegistry = createApplicationRegistry([
  ...accessoryApplications,
  ...systemToolApplications,
  ...systemApplications,
  minesweeperApplication,
  notepadApplication,
  paintApplication,
  winampApplication,
  solitaireApplication,
  pinballApplication,
]);

window.AstroShellApplications.install(applicationRegistry);
