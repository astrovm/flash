const buttonRow = (dialogs, dialog, accept) => {
  const row = document.createElement("div");
  row.className = "dlg-buttons";
  const ok = dialogs.createDialogButton(
    { id: "ok", label: "OK", isDefault: true },
    accept,
  );
  const cancel = dialogs.createDialogButton(
    { id: "cancel", label: "Cancel" },
    () => dialog.close(null),
  );
  row.append(ok, cancel);
  dialog.body.appendChild(row);
  dialog.defaultButton = ok;
};

const addHelpButton = (dialog) => {
  const help = document.createElement("button");
  help.type = "button";
  help.className = "tb-btn help-btn";
  help.title = "Help";
  help.setAttribute("aria-label", "Help");
  dialog.el.querySelector(".title-buttons").prepend(help);
};

const numericInput = (name, value, suffix = "%") =>
  `<label><span>${name}:</span><input name="${name.toLowerCase()}" type="number" value="${value}"><span>${suffix}</span></label>`;

export const showTransformDialog = (dialogs, kind) =>
  new Promise((resolve) => {
    const flip = kind === "flip";
    const dialog = dialogs.createDialog({
      title: flip ? "Flip and Rotate" : "Stretch and Skew",
      onCancel: () => dialog.close(null),
    });
    addHelpButton(dialog);
    dialog.el.classList.add("paint-transform-dialog");
    dialog.body.innerHTML = flip
      ? `<fieldset><legend>Flip or rotate</legend>
          <label><input type="radio" name="operation" value="horizontal" checked>Flip horizontal</label>
          <label><input type="radio" name="operation" value="vertical">Flip vertical</label>
          <label><input type="radio" name="operation" value="rotate">Rotate by angle</label>
        </fieldset><fieldset class="paint-angle"><legend>Rotate by angle</legend>
          <label><input type="radio" name="angle" value="90" checked>90°</label>
          <label><input type="radio" name="angle" value="180">180°</label>
          <label><input type="radio" name="angle" value="270">270°</label>
        </fieldset>`
      : `<fieldset><legend>Stretch</legend>${numericInput("Horizontal", 100)}${numericInput("Vertical", 100)}</fieldset>
         <fieldset><legend>Skew</legend>${numericInput("Horizontal", 0, "Degrees")}${numericInput("Vertical", 0, "Degrees")}</fieldset>`;
    buttonRow(dialogs, dialog, () => {
      const values = {};
      if (flip) {
        values.operation = dialog.body.querySelector(
          '[name="operation"]:checked',
        ).value;
        values.angle = Number(
          dialog.body.querySelector('[name="angle"]:checked').value,
        );
      } else {
        const inputs = dialog.body.querySelectorAll("input[type=number]");
        values.horizontalStretch = Number(inputs[0].value);
        values.verticalStretch = Number(inputs[1].value);
        values.horizontalSkew = Number(inputs[2].value);
        values.verticalSkew = Number(inputs[3].value);
      }
      dialog.close(values);
    });
    dialog.onResult(resolve);
  });

export const showAttributesDialog = (dialogs, { width, height }) =>
  new Promise((resolve) => {
    const dialog = dialogs.createDialog({
      title: "Attributes",
      onCancel: () => dialog.close(null),
    });
    addHelpButton(dialog);
    dialog.el.classList.add("paint-attributes-dialog");
    dialog.body.innerHTML = `<p>Width: <input name="width" type="number" min="1" max="4096" value="${width}"></p>
      <p>Height: <input name="height" type="number" min="1" max="4096" value="${height}"></p>
      <fieldset><legend>Units</legend><label><input type="radio" checked>Pixels</label></fieldset>
      <fieldset><legend>Colors</legend><label><input type="radio" checked>Colors</label><label><input type="radio" disabled>Black and white</label></fieldset>`;
    buttonRow(dialogs, dialog, () =>
      dialog.close({
        width: Number(dialog.body.querySelector('[name="width"]').value),
        height: Number(dialog.body.querySelector('[name="height"]').value),
      }),
    );
    dialog.onResult(resolve);
  });

export const showEditColorsDialog = (dialogs, colors, selected) =>
  new Promise((resolve) => {
    const dialog = dialogs.createDialog({
      title: "Edit Colors",
      onCancel: () => dialog.close(null),
    });
    addHelpButton(dialog);
    dialog.el.classList.add("paint-edit-colors-dialog");
    const heading = document.createElement("div");
    heading.textContent = "Basic colors:";
    const grid = document.createElement("div");
    grid.className = "paint-edit-color-grid";
    let value = selected;
    for (const color of colors) {
      const swatch = document.createElement("button");
      swatch.type = "button";
      swatch.style.background = color;
      swatch.classList.toggle("selected", color === value);
      swatch.addEventListener("click", () => {
        value = color;
        grid
          .querySelectorAll("button")
          .forEach((item) =>
            item.classList.toggle("selected", item === swatch),
          );
      });
      grid.appendChild(swatch);
    }
    const customHeading = document.createElement("div");
    customHeading.textContent = "Custom colors:";
    const custom = document.createElement("div");
    custom.className = "paint-custom-colors";
    custom.innerHTML = "<i></i>".repeat(16);
    const define = document.createElement("button");
    define.type = "button";
    define.textContent = "Define Custom Colors >>";
    define.disabled = true;
    dialog.body.append(heading, grid, customHeading, custom, define);
    buttonRow(dialogs, dialog, () => dialog.close(value));
    dialog.onResult(resolve);
  });
