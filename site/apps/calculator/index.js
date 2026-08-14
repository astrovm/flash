import { defineApplication } from "../core/application.js";
import { mountSharedBoxedWineApplication } from "../core/boxedwine-runtime.js";

export const calculatorApplication = defineApplication({
  id: "__calculator",
  title: "Calculator",
  icon: "Calculator.png",
  kind: "native-game",
  window: {
    width: 260,
    height: 260,
    resizable: false,
    maximizable: false,
    className: "xp-boxedwine-shared-window",
  },
  mount: (context) => mountSharedBoxedWineApplication("calculator", context),
});
