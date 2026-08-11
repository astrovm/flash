import { mountBoxedWineApplication } from "../core/boxedwine.js";
import { defineApplication } from "../core/application.js";

const mountSolitaire = () =>
  mountBoxedWineApplication({
    title: "Windows XP Solitaire",
    packageId: "solitaire",
    archive: "xp-solitaire",
    executable: "sol.exe",
    nativeWidth: 586,
    nativeHeight: 406,
    resolution: "800x600",
    frameTop: 32,
    background: "#27811f",
  });

export const solitaireApplication = defineApplication({
  id: "__solitaire",
  title: "Solitaire",
  icon: "Solitaire.png",
  kind: "native-game",
  window: {
    width: 592,
    height: 438,
    className: "xp-native-solitaire-window",
    resizable: true,
    maximizable: true,
  },
  mount: mountSolitaire,
});
