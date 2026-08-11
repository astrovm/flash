import { defineApplication } from "../core/application.js";
import { showXPAboutDialog } from "../core/about-dialog.js";
import { installPaintScrollbars } from "./scrollbars.js";

const COLORS = [
  "#000000",
  "#808080",
  "#800000",
  "#808000",
  "#008000",
  "#008080",
  "#000080",
  "#800080",
  "#808040",
  "#004040",
  "#0080ff",
  "#004080",
  "#8000ff",
  "#804000",
  "#ffffff",
  "#c0c0c0",
  "#ff0000",
  "#ffff00",
  "#00ff00",
  "#00ffff",
  "#0000ff",
  "#ff00ff",
  "#ffff80",
  "#00ff80",
  "#80ffff",
  "#8080ff",
  "#ff0080",
  "#ff8040",
];

const TOOLS = [
  ["select", "Free-Form Select"],
  ["rect-select", "Select"],
  ["eraser", "Eraser/Color Eraser"],
  ["fill", "Fill With Color"],
  ["picker", "Pick Color"],
  ["magnifier", "Magnifier"],
  ["pencil", "Pencil"],
  ["brush", "Brush"],
  ["airbrush", "Airbrush"],
  ["text", "Text"],
  ["line", "Line"],
  ["curve", "Curve"],
  ["rectangle", "Rectangle"],
  ["polygon", "Polygon"],
  ["ellipse", "Ellipse"],
  ["rounded", "Rounded Rectangle"],
];

const MENU_ITEMS = {
  File: [
    ["new", "New", "Ctrl+N"],
    ["open", "Open...", "Ctrl+O"],
    ["save", "Save", "Ctrl+S"],
    ["save-as", "Save As...", ""],
    ["separator"],
    ["wallpaper", "Set As Background (Centered)", ""],
    ["separator"],
    ["exit", "Exit", "Alt+F4"],
  ],
  Edit: [
    ["undo", "Undo", "Ctrl+Z"],
    ["redo", "Repeat", "F4"],
    ["separator"],
    ["clear", "Clear Selection", "Del"],
  ],
  View: [
    ["toolbox", "Tool Box", "Ctrl+T"],
    ["colorbox", "Color Box", "Ctrl+L"],
    ["status", "Status Bar", ""],
  ],
  Image: [
    ["flip", "Flip/Rotate...", "Ctrl+R"],
    ["stretch", "Stretch/Skew...", "Ctrl+W"],
    ["invert", "Invert Colors", "Ctrl+I"],
    ["attributes", "Attributes...", "Ctrl+E"],
    ["clear-image", "Clear Image", "Ctrl+Shift+N"],
  ],
  Colors: [["edit-colors", "Edit Colors...", ""]],
  Help: [
    ["help", "Help Topics", "F1"],
    ["separator"],
    ["about", "About Paint", ""],
  ],
};

const createMenuBar = (run) => {
  const bar = document.createElement("div");
  bar.className = "paint-menu-bar";
  bar.setAttribute("role", "menubar");
  for (const [name, items] of Object.entries(MENU_ITEMS)) {
    const group = document.createElement("div");
    group.className = "paint-menu-group";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = name;
    trigger.setAttribute("aria-haspopup", "menu");
    const menu = document.createElement("div");
    menu.className = "paint-menu";
    menu.hidden = true;
    menu.setAttribute("role", "menu");
    for (const [command, label, shortcut] of items) {
      if (command === "separator") {
        menu.appendChild(document.createElement("hr"));
        continue;
      }
      const item = document.createElement("button");
      item.type = "button";
      item.dataset.paintCommand = command;
      item.innerHTML = `<span></span><span></span>`;
      item.children[0].textContent = label;
      item.children[1].textContent = shortcut;
      item.addEventListener("click", () => {
        menu.hidden = true;
        run(command);
      });
      menu.appendChild(item);
    }
    trigger.addEventListener("click", () => {
      bar.querySelectorAll(".paint-menu").forEach((other) => {
        if (other !== menu) other.hidden = true;
      });
      menu.hidden = !menu.hidden;
    });
    group.append(trigger, menu);
    bar.appendChild(group);
  }
  return bar;
};

const canvasBlob = (canvas, type = "image/png") =>
  new Promise((resolve) => canvas.toBlob(resolve, type));

const floodFill = (context, x, y, color) => {
  const { width, height } = context.canvas;
  const image = context.getImageData(0, 0, width, height);
  const start = (Math.floor(y) * width + Math.floor(x)) * 4;
  const target = image.data.slice(start, start + 4);
  const fill = color.match(/[a-f\d]{2}/gi).map((part) => parseInt(part, 16));
  if (target[0] === fill[0] && target[1] === fill[1] && target[2] === fill[2])
    return;
  const stack = [[Math.floor(x), Math.floor(y)]];
  while (stack.length) {
    const [px, py] = stack.pop();
    if (px < 0 || py < 0 || px >= width || py >= height) continue;
    const offset = (py * width + px) * 4;
    if (target.some((value, index) => image.data[offset + index] !== value))
      continue;
    image.data.set([...fill, 255], offset);
    stack.push([px - 1, py], [px + 1, py], [px, py - 1], [px, py + 1]);
  }
  context.putImageData(image, 0, 0);
};

const mountPaint = (shell, instance) => {
  const root = document.createElement("div");
  root.className = "xp-native-program xp-native-paint";
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 342;
  canvas.className = "paint-canvas";
  canvas.setAttribute("aria-label", "Drawing canvas");
  canvas.tabIndex = 0;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  let tool = "pencil";
  let primary = "#000000";
  let secondary = "#ffffff";
  let drawing = false;
  let start = null;
  let snapshot = null;
  let fileId = null;
  let fileName = "untitled";
  let undoImage = null;
  let dirty = false;

  const setTitle = () => shell.setTitle(`${fileName} - Paint`);
  const point = (event) => {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };
  const rememberUndo = () => {
    undoImage = context.getImageData(0, 0, canvas.width, canvas.height);
  };
  const loadFile = async (file) => {
    const image = document.createElement("img");
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = file.content;
    });
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    context.drawImage(image, 0, 0);
    fileId = file.id;
    fileName = file.name;
    dirty = false;
    setTitle();
  };
  const save = async (saveAs = false) => {
    let destination =
      fileId && !saveAs ? { existingId: fileId, name: fileName } : null;
    if (!destination) {
      destination = await shell.saveFile({
        title: "Save As",
        defaultName: fileName,
        startFolder: shell.myPictures,
      });
    }
    if (!destination) return false;
    const type = /\.jpe?g$/i.test(destination.name)
      ? "image/jpeg"
      : "image/png";
    const blob = await canvasBlob(canvas, type);
    const content = await shell.dataUrlFromBlob(blob);
    const file = destination.existingId
      ? shell.setFileContent(destination.existingId, content)
      : shell.createFile(
          destination.parentId,
          /\.[^.]+$/.test(destination.name)
            ? destination.name
            : `${destination.name}.png`,
          content,
        );
    fileId = file.id;
    fileName = file.name;
    dirty = false;
    setTitle();
    return true;
  };
  const confirmSaveChanges = async () => {
    if (!dirty) return true;
    const answer = await shell.dialogs.message({
      title: "Paint",
      text: `Save changes to ${fileName}?`,
      icon: "warning",
      buttons: shell.dialogs.BUTTON_SETS.yesNoCancel,
      defaultButton: "yes",
    });
    if (answer === "cancel") return false;
    return answer === "no" ? true : save(false);
  };
  const run = async (command) => {
    if (command === "new") {
      if (!(await confirmSaveChanges())) return;
      rememberUndo();
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      fileId = null;
      fileName = "untitled";
      dirty = false;
      setTitle();
    } else if (command === "open") {
      if (!(await confirmSaveChanges())) return;
      const file = await shell.openFile({
        title: "Open",
        startFolder: shell.myPictures,
        filter: (node) =>
          node.type === "folder" ||
          /\.(bmp|dib|gif|jpe?g|png)$/i.test(node.name),
      });
      if (file) await loadFile(file);
    } else if (command === "save") await save(false);
    else if (command === "save-as") await save(true);
    else if (command === "exit") shell.close();
    else if (command === "undo" && undoImage) {
      context.putImageData(undoImage, 0, 0);
      dirty = true;
    } else if (command === "clear" || command === "clear-image") {
      rememberUndo();
      context.fillStyle = secondary;
      context.fillRect(0, 0, canvas.width, canvas.height);
      dirty = true;
    } else if (command === "invert") {
      rememberUndo();
      const image = context.getImageData(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < image.data.length; i += 4) {
        image.data[i] = 255 - image.data[i];
        image.data[i + 1] = 255 - image.data[i + 1];
        image.data[i + 2] = 255 - image.data[i + 2];
      }
      context.putImageData(image, 0, 0);
      dirty = true;
    } else if (command === "wallpaper") shell.setWallpaper(canvas.toDataURL());
    else if (command === "about")
      showXPAboutDialog(shell.dialogs, {
        title: "About Paint",
        product: "Microsoft ® Paint",
        version: "Version 5.1 (Build 2600.xpsp.080413-2111 : Service Pack 3)",
        copyright: "Copyright © 2007 Microsoft Corporation",
        icon: shell.XP_ICON_PATHS["PaintLarge.png"],
      });
    else if (command === "help")
      shell.showMessage(
        "Paint Help",
        "Select a tool, then drag on the drawing area. Use File to open or save pictures.",
      );
    else if (["toolbox", "colorbox", "status"].includes(command))
      root
        .querySelector(`[data-paint-panel="${command}"]`)
        .toggleAttribute("hidden");
    else shell.showMessage("Paint", "This command is not available yet.");
  };

  root.appendChild(createMenuBar(run));
  const body = document.createElement("div");
  body.className = "paint-body";
  const toolbox = document.createElement("div");
  toolbox.className = "paint-toolbox";
  toolbox.dataset.paintPanel = "toolbox";
  const toolOptions = document.createElement("div");
  toolOptions.className = "paint-tool-options";
  toolOptions.dataset.tool = tool;
  for (const [index, [id, label]] of TOOLS.entries()) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `paint-tool paint-tool-${id}`;
    button.title = label;
    button.setAttribute("aria-label", label);
    button.dataset.tool = id;
    button.style.setProperty("--paint-tool-index", String(index));
    button.classList.toggle("selected", id === tool);
    button.addEventListener("click", () => {
      tool = id;
      toolOptions.dataset.tool = tool;
      toolbox
        .querySelectorAll(".paint-tool")
        .forEach((item) => item.classList.toggle("selected", item === button));
    });
    toolbox.appendChild(button);
  }
  toolbox.appendChild(toolOptions);
  const workspace = document.createElement("div");
  workspace.className = "paint-workspace";
  const workspaceShell = document.createElement("div");
  workspaceShell.className = "paint-workspace-shell";
  const canvasFrame = document.createElement("div");
  canvasFrame.className = "paint-canvas-frame";
  canvasFrame.appendChild(canvas);
  workspace.appendChild(canvasFrame);
  workspaceShell.appendChild(workspace);
  const removeScrollbars = installPaintScrollbars(
    workspaceShell,
    workspace,
    canvas,
  );
  body.append(toolbox, workspaceShell);
  root.appendChild(body);

  const colors = document.createElement("div");
  colors.className = "paint-color-box";
  colors.dataset.paintPanel = "colorbox";
  const current = document.createElement("div");
  current.className = "paint-current-colors";
  const updateCurrent = () => {
    current.style.setProperty("--paint-primary", primary);
    current.style.setProperty("--paint-secondary", secondary);
  };
  updateCurrent();
  colors.appendChild(current);
  const palette = document.createElement("div");
  palette.className = "paint-palette-grid";
  for (const color of COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "paint-swatch";
    swatch.style.backgroundColor = color;
    swatch.title = color;
    swatch.addEventListener("click", () => {
      primary = color;
      updateCurrent();
    });
    swatch.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      secondary = color;
      updateCurrent();
    });
    palette.appendChild(swatch);
  }
  colors.appendChild(palette);
  root.appendChild(colors);
  const status = document.createElement("div");
  status.className = "paint-status";
  status.dataset.paintPanel = "status";
  status.innerHTML = `<span data-paint-help>For Help, click Help Topics on the Help Menu.</span><span data-paint-position></span>`;
  root.appendChild(status);

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button > 2) return;
    drawing = true;
    start = point(event);
    rememberUndo();
    snapshot = context.getImageData(0, 0, canvas.width, canvas.height);
    context.strokeStyle = event.button === 2 ? secondary : primary;
    context.fillStyle = event.button === 2 ? secondary : primary;
    context.lineWidth = tool === "brush" ? 4 : tool === "eraser" ? 10 : 1;
    context.lineCap = "round";
    if (tool === "fill") {
      floodFill(context, start.x, start.y, context.fillStyle);
      dirty = true;
      drawing = false;
    } else if (tool === "picker") {
      const pixel = context.getImageData(start.x, start.y, 1, 1).data;
      primary = `#${[pixel[0], pixel[1], pixel[2]].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
      updateCurrent();
      drawing = false;
    } else {
      context.beginPath();
      context.moveTo(start.x, start.y);
      canvas.setPointerCapture(event.pointerId);
    }
  });
  canvas.addEventListener("pointermove", (event) => {
    const next = point(event);
    status.querySelector("[data-paint-position]").textContent =
      `${Math.round(next.x)}, ${Math.round(next.y)}px`;
    if (!drawing) return;
    if (["pencil", "brush", "eraser", "airbrush"].includes(tool)) {
      context.lineTo(next.x, next.y);
      context.stroke();
    } else if (["line", "rectangle", "ellipse", "rounded"].includes(tool)) {
      context.putImageData(snapshot, 0, 0);
      context.beginPath();
      if (tool === "line") {
        context.moveTo(start.x, start.y);
        context.lineTo(next.x, next.y);
      } else if (tool === "ellipse")
        context.ellipse(
          (start.x + next.x) / 2,
          (start.y + next.y) / 2,
          Math.abs(next.x - start.x) / 2,
          Math.abs(next.y - start.y) / 2,
          0,
          0,
          Math.PI * 2,
        );
      else context.rect(start.x, start.y, next.x - start.x, next.y - start.y);
      context.stroke();
    }
  });
  const finishDrawing = () => {
    if (drawing) dirty = true;
    drawing = false;
    context.closePath();
  };
  canvas.addEventListener("pointerup", finishDrawing);
  canvas.addEventListener("pointercancel", finishDrawing);
  root.addEventListener("keydown", (event) => {
    if (!(event.ctrlKey || event.metaKey)) return;
    const command = { n: "new", o: "open", s: "save", z: "undo" }[
      event.key.toLowerCase()
    ];
    if (command) {
      event.preventDefault();
      run(command);
    }
  });

  setTitle();
  if (instance.file) void loadFile(instance.file);
  return {
    element: root,
    beforeClose: confirmSaveChanges,
    async openFile(file) {
      if (!(await confirmSaveChanges())) return false;
      await loadFile(file);
      return true;
    },
    unmount: removeScrollbars,
  };
};

export const paintApplication = defineApplication({
  id: "__paint",
  title: "Paint",
  icon: "Paint.png",
  kind: "paint",
  window: {
    width: 760,
    height: 560,
    left: 0,
    top: 0,
    className: "xp-native-paint-window",
  },
  fileTypes: [".bmp", ".dib", ".gif", ".jpg", ".jpeg", ".png"],
  mount: mountPaint,
});
