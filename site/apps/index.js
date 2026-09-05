import { defineLazyApplication } from "./core/lazy-application.js";
import { accessoryApplications } from "./catalog/accessories.js";
import { systemToolApplications } from "./catalog/system-tools.js";
import { systemApplications } from "./catalog/system-applications.js";
import { createApplicationRegistry } from "./core/registry.js";
import { boxedWineShellApplications } from "./core/boxedwine-application.js";
import "./core/boxedwine-preload.js";
import { applicationMetadata as paintMetadata } from "./paint/metadata.js";
const paintApplication = defineLazyApplication(paintMetadata, () =>
  import("./paint/index.js").then((module) => module.paintApplication),
);
import { applicationMetadata as notepadMetadata } from "./notepad/metadata.js";
const notepadApplication = defineLazyApplication(notepadMetadata, () =>
  import("./notepad/index.js").then((module) => module.notepadApplication),
);
import { applicationMetadata as minesweeperMetadata } from "./minesweeper/metadata.js";
const minesweeperApplication = defineLazyApplication(minesweeperMetadata, () =>
  import("./minesweeper/index.js").then(
    (module) => module.minesweeperApplication,
  ),
);
import { applicationMetadata as pinballMetadata } from "./pinball/metadata.js";
const pinballApplication = defineLazyApplication(pinballMetadata, () =>
  import("./pinball/index.js").then((module) => module.pinballApplication),
);

export const applicationRegistry = createApplicationRegistry([
  ...accessoryApplications,
  ...systemToolApplications,
  ...systemApplications,
  ...boxedWineShellApplications,
  minesweeperApplication,
  notepadApplication,
  paintApplication,
  pinballApplication,
]);

window.AstroShellApplications.install(applicationRegistry);
