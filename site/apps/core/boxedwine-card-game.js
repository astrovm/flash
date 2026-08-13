import { defineApplication } from "./application.js";
import { mountBoxedWineApplication } from "./boxedwine.js";

export const defineBoxedWineCardGame = ({
  id,
  title,
  icon,
  archive,
  width,
  height,
  nativeWidth = width - 6,
  nativeHeight = height - 32,
}) =>
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
    },
    mount: () =>
      mountBoxedWineApplication({
        title: `Windows XP ${title}`,
        packageId: id,
        archive,
        executable: "resize-host.exe",
        nativeWidth,
        nativeHeight,
        frameTop: 32,
        background: "#27811f",
      }),
  });
