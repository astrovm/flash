import { defineApplication } from "./application.js";
import { boxedWineApplications } from "./boxedwine-applications.js";
import { mountSharedBoxedWineApplication } from "./boxedwine-runtime.js";

// Native window metadata corrects these once the guest process reports its
// real size, but that round-trip only starts after the Wine process boots;
// starting from each application's actual size (instead of the generic
// defineApplication() default) avoids a visible flash/jump on open.
const WINDOW_DEFAULTS = {
  calculator: { width: 260, height: 260, resizable: false, maximizable: false },
  solitaire: { width: 592, height: 438, resizable: true, maximizable: true },
  freecell: { width: 646, height: 479, resizable: true, maximizable: true },
  "spider-solitaire": {
    width: 800,
    height: 600,
    resizable: true,
    maximizable: true,
  },
};

const defineBoxedWineApplication = (application) =>
  defineApplication({
    id: `__${application.id}`,
    title: application.title,
    icon: application.icon,
    kind: "native-game",
    deepLinkId: application.id,
    offlineGameId: application.id,
    window: {
      className: "xp-boxedwine-shared-window",
      nativeMetadata: true,
      ...WINDOW_DEFAULTS[application.id],
    },
    mount: (context) =>
      mountSharedBoxedWineApplication(application.id, context),
  });

export const boxedWineShellApplications = boxedWineApplications.map(
  defineBoxedWineApplication,
);
