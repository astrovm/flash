import { defineApplication } from "./application.js";
import { mountSharedBoxedWineApplication } from "./boxedwine-runtime.js";

export const defineBoxedWineCardGame = ({ id, title, icon, width, height }) =>
  defineApplication({
    id: `__${id}`,
    title,
    icon,
    kind: "native-game",
    deepLinkId: id,
    offlineGameId: id,
    window: {
      width,
      height,
      fitToWorkArea: true,
      resizable: true,
      maximizable: true,
      className: "xp-boxedwine-shared-window",
      customChrome: true,
    },
    mount: (context) => mountSharedBoxedWineApplication(id, context),
  });
