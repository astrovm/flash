import { defineApplication } from "./application.js";
import { boxedWineApplications } from "./boxedwine-applications.js";
import { defineLazyApplication } from "./lazy-application.js";

// The BoxedWine runtime and window surface load with the first XP program.
let runtimeModule = null;
const loadBoxedWineRuntime = () =>
  (runtimeModule ??= import("./boxedwine-runtime.js").catch((error) => {
    runtimeModule = null;
    throw error;
  }));

const defineBoxedWineApplication = (application) => {
  const metadata = {
    id: `__${application.id}`,
    title: application.title,
    icon: application.icon,
    kind: "native-game",
    deepLinkId: application.id,
    offlineGameId: application.id,
    window: {
      className: "xp-boxedwine-shared-window",
      nativeMetadata: true,
    },
  };
  return defineLazyApplication(metadata, () =>
    loadBoxedWineRuntime().then(({ mountSharedBoxedWineApplication }) =>
      defineApplication({
        ...metadata,
        mount: (context) =>
          mountSharedBoxedWineApplication(application.id, context),
      }),
    ),
  );
};

export const boxedWineShellApplications = boxedWineApplications.map(
  defineBoxedWineApplication,
);
