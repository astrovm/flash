import { defineApplication } from "../core/application.js";
import { createSystemRuntime } from "../system/runtime.js";

const system = (id, title, icon, window = {}, activation = null) =>
  defineApplication({
    id,
    title,
    icon,
    kind: "system",
    window: { width: 800, height: 600, ...window },
    mount(context, instance) {
      const runtime = createSystemRuntime(context);
      return {
        element: runtime.render(id, instance.window),
        activate: () => runtime.activate(activation, instance.window),
        unmount() {},
      };
    },
    activate(_context, _instance, mounted) {
      mounted.activate();
    },
  });

export const systemApplications = [
  system("__my-computer", "My Computer", "MyComputer.png"),
  system("__my-documents", "My Documents", "MyDocuments.png"),
  system("__my-pictures", "My Pictures", "MyPictures.png"),
  system("__my-music", "My Music", "MyMusic.png"),
  system("__recycle-bin", "Recycle Bin", "RecyclerEmpty.png"),
  system(
    "__control-panel",
    "Control Panel",
    "ControlPanel.png",
    { left: 44, top: 58 },
    "control-panel",
  ),
  system("__user-accounts", "User Accounts", "UserAccounts.png", {
    width: 729,
    height: 530,
    left: 147,
    top: 52,
    className: "user-accounts-window",
  }),
  system(
    "__add-remove-programs",
    "Add or Remove Programs",
    "AddRemovePrograms.png",
    {
      width: 729,
      height: 530,
      left: 147,
      top: 104,
      className: "add-remove-programs-window",
    },
  ),
  system("__security-center", "Windows Security Center", "SecurityCenter.png", {
    width: 748,
    height: 600,
    left: 138,
    top: 70,
  }),
  system(
    "__printers",
    "Printers and Faxes",
    "PrintersAndFaxes.png",
    { left: 22, top: 29 },
    "printers",
  ),
  system(
    "__help",
    "Help and Support Center",
    "HelpAndSupport.png",
    { width: 768, height: 650, left: 66, top: 45 },
    "help",
  ),
  system(
    "__search",
    "Search Results",
    "Search.png",
    { left: 66, top: 88 },
    "search",
  ),
  system(
    "__astro-settings",
    "Astro Flash Settings",
    "ControlPanel.png",
    { width: 540, height: 420 },
    "project-settings",
  ),
  system(
    "__internet-games",
    "Internet Games",
    "AddRemovePrograms.png",
    { width: 760, height: 540 },
    "internet-games",
  ),
  system(
    "__display-properties",
    "Display Properties",
    "DisplaySettings.png",
    {
      width: 404,
      height: 454,
      left: 22,
      top: 30,
      className: "display-properties-window",
      dialogControls: true,
    },
    "display-properties",
  ),
];
