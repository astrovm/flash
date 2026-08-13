import { defineApplication } from "../core/application.js";
import { mountBoxedWineApplication } from "../core/boxedwine.js";

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
    className: "xp-calculator-window",
  },
  mount: (context) =>
    mountBoxedWineApplication({
      title: "Windows XP Calculator",
      packageId: "calculator",
      archive: "xp-calculator",
      executable: "window-host.exe",
      nativeWidth: 254,
      nativeHeight: 229,
      frameTop: 32,
      nativeFrameWidth: 6,
      nativeFrameHeight: 31,
      background: "#ece9d8",
      onWindowSize(width, height) {
        const workArea = context.getDesktopSize();
        context.setSize(
          workArea.width > 0 ? Math.min(width, workArea.width) : width,
          workArea.height > 0 ? Math.min(height, workArea.height) : height,
        );
      },
    }),
});
