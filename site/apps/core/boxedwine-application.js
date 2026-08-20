import { defineApplication } from "./application.js";
import { boxedWineApplications } from "./boxedwine-applications.js";
import { mountSharedBoxedWineApplication } from "./boxedwine-runtime.js";

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
    },
    mount: (context) =>
      mountSharedBoxedWineApplication(application.id, context),
  });

export const boxedWineShellApplications = boxedWineApplications.map(
  defineBoxedWineApplication,
);
