import { createProgramRoot } from "../ui.js";

const MAX_DIGITS = 32;

const formatNumber = (value) => {
  if (!Number.isFinite(value)) return "Cannot divide by zero.";
  if (Object.is(value, -0)) return "0";
  const absoluteValue = Math.abs(value);
  if (absoluteValue >= 1e16 || (absoluteValue > 0 && absoluteValue < 1e-15)) {
    return value
      .toExponential(15)
      .replace(/\.0+e/, "e")
      .replace(/(\.\d*?)0+e/, "$1e");
  }
  return String(Number(value.toPrecision(15)));
};

const BUTTONS = [
  ["MC", "memory-clear", "memory"],
  ["7", "7", "number"],
  ["8", "8", "number"],
  ["9", "9", "number"],
  ["/", "divide", "operator"],
  ["sqrt", "square-root", "function"],
  ["MR", "memory-recall", "memory"],
  ["4", "4", "number"],
  ["5", "5", "number"],
  ["6", "6", "number"],
  ["*", "multiply", "operator"],
  ["%", "percent", "function"],
  ["MS", "memory-store", "memory"],
  ["1", "1", "number"],
  ["2", "2", "number"],
  ["3", "3", "number"],
  ["-", "subtract", "operator"],
  ["1/x", "reciprocal", "function"],
  ["M+", "memory-add", "memory"],
  ["0", "0", "number"],
  ["+/-", "sign", "number"],
  [".", "decimal", "number"],
  ["+", "add", "operator"],
  ["=", "equals", "operator"],
];

const createMenu = (label, items) => {
  const group = document.createElement("div");
  group.className = "xp-calculator-menu-group";
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.className = "xp-calculator-menu-trigger";
  trigger.textContent = label;
  trigger.setAttribute("aria-haspopup", "menu");
  trigger.setAttribute("aria-expanded", "false");
  const popup = document.createElement("div");
  popup.className = "xp-calculator-popup";
  popup.hidden = true;
  popup.setAttribute("role", "menu");
  for (const item of items) {
    if (item.separator) {
      const separator = document.createElement("hr");
      separator.setAttribute("role", "separator");
      popup.appendChild(separator);
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.command = item.command;
    button.disabled = Boolean(item.disabled);
    button.setAttribute("role", item.role || "menuitem");
    if (item.checked !== undefined) {
      button.setAttribute("aria-checked", String(item.checked));
    }
    button.innerHTML = `<span class="xp-calculator-menu-check">${item.checked ? "●" : ""}</span><span>${item.label}</span><kbd>${item.key || ""}</kbd>`;
    popup.appendChild(button);
  }
  group.append(trigger, popup);
  return group;
};

export const renderCalculator = (context, program) => {
  const content = createProgramRoot(program);
  content.tabIndex = -1;
  content.innerHTML = `
    <div class="xp-calculator-menu-bar" role="menubar"></div>
    <div class="xp-calculator-body">
      <input class="xp-calculator-display" value="0." aria-label="Calculator display" readonly>
      <div class="xp-calculator-clear-row">
        <span class="xp-calculator-memory-indicator" aria-label="Memory indicator"></span>
        <button type="button" data-command="backspace">Backspace</button>
        <button type="button" data-command="clear-entry">CE</button>
        <button type="button" data-command="clear">C</button>
      </div>
      <div class="xp-calculator-keys" aria-label="Calculator keypad"></div>
    </div>`;

  const display = content.querySelector(".xp-calculator-display");
  const keys = content.querySelector(".xp-calculator-keys");
  const memoryIndicator = content.querySelector(
    ".xp-calculator-memory-indicator",
  );
  let entry = "0";
  let accumulator = null;
  let pendingOperator = null;
  let replaceEntry = true;
  let lastOperator = null;
  let lastOperand = null;
  let memory = 0;
  let error = false;

  const showEntry = () => {
    display.value = error ? entry : entry.includes(".") ? entry : `${entry}.`;
  };

  const setValue = (value) => {
    entry = formatNumber(value);
    error = !Number.isFinite(value);
    replaceEntry = true;
    showEntry();
  };

  const currentValue = () => Number(entry);

  const calculate = (left, operator, right) => {
    if (operator === "add") return left + right;
    if (operator === "subtract") return left - right;
    if (operator === "multiply") return left * right;
    if (operator === "divide") return right === 0 ? Number.NaN : left / right;
    return right;
  };

  const clearAll = () => {
    entry = "0";
    accumulator = null;
    pendingOperator = null;
    lastOperator = null;
    lastOperand = null;
    replaceEntry = true;
    error = false;
    showEntry();
  };

  const inputDigit = (digit) => {
    if (error) clearAll();
    if (replaceEntry) {
      entry = digit;
      replaceEntry = false;
    } else if (entry === "0") {
      entry = digit;
    } else if (entry.replace(/[-.]/g, "").length < MAX_DIGITS) {
      entry += digit;
    }
    showEntry();
  };

  const inputDecimal = () => {
    if (error) clearAll();
    if (replaceEntry) {
      entry = "0.";
      replaceEntry = false;
    } else if (!entry.includes(".")) {
      entry += ".";
    }
    showEntry();
  };

  const selectOperator = (operator) => {
    if (error) return;
    const value = currentValue();
    if (pendingOperator && !replaceEntry) {
      const result = calculate(accumulator, pendingOperator, value);
      setValue(result);
      accumulator = result;
    } else if (accumulator === null) {
      accumulator = value;
    }
    pendingOperator = operator;
    replaceEntry = true;
  };

  const equals = () => {
    if (error) return;
    let operator = pendingOperator;
    let operand = currentValue();
    if (!operator && lastOperator) {
      operator = lastOperator;
      operand = lastOperand;
    }
    if (!operator) return;
    const left = accumulator ?? currentValue();
    const result = calculate(left, operator, operand);
    lastOperator = operator;
    lastOperand = operand;
    pendingOperator = null;
    accumulator = result;
    setValue(result);
  };

  const runCommand = (command) => {
    if (/^\d$/.test(command)) {
      inputDigit(command);
      return;
    }
    if (command === "decimal") {
      inputDecimal();
      return;
    }
    if (command === "clear") {
      clearAll();
      return;
    }
    if (command === "clear-entry") {
      entry = "0";
      replaceEntry = true;
      error = false;
      showEntry();
      return;
    }
    if (command === "backspace") {
      if (!replaceEntry && !error) {
        entry = entry.length > 1 ? entry.slice(0, -1) : "0";
        if (entry === "-") entry = "0";
        showEntry();
      }
      return;
    }
    if (["add", "subtract", "multiply", "divide"].includes(command)) {
      selectOperator(command);
      return;
    }
    if (command === "equals") {
      equals();
      return;
    }
    if (error) return;
    const value = currentValue();
    if (command === "sign") {
      if (value !== 0)
        entry = entry.startsWith("-") ? entry.slice(1) : `-${entry}`;
      showEntry();
    } else if (command === "square-root") {
      setValue(value < 0 ? Number.NaN : Math.sqrt(value));
    } else if (command === "reciprocal") {
      setValue(value === 0 ? Number.NaN : 1 / value);
    } else if (command === "percent") {
      const percentValue =
        pendingOperator === "add" || pendingOperator === "subtract"
          ? ((accumulator ?? 0) * value) / 100
          : value / 100;
      setValue(percentValue);
    } else if (command === "memory-clear") {
      memory = 0;
      memoryIndicator.textContent = "";
    } else if (command === "memory-recall") {
      setValue(memory);
    } else if (command === "memory-store") {
      memory = value;
      memoryIndicator.textContent = memory === 0 ? "" : "M";
      replaceEntry = true;
    } else if (command === "memory-add") {
      memory += value;
      memoryIndicator.textContent = memory === 0 ? "" : "M";
      replaceEntry = true;
    }
  };

  for (const [label, command, type] of BUTTONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.command = command;
    button.dataset.keyType = type;
    keys.appendChild(button);
  }

  content.querySelectorAll("[data-command]").forEach((button) => {
    button.addEventListener("click", () => runCommand(button.dataset.command));
  });

  const menuBar = content.querySelector(".xp-calculator-menu-bar");
  const menus = [
    createMenu("Edit", [
      { label: "Copy", command: "copy", key: "Ctrl+C" },
      { label: "Paste", command: "paste", key: "Ctrl+V" },
    ]),
    createMenu("View", [
      {
        label: "Standard",
        command: "standard",
        role: "menuitemradio",
        checked: true,
      },
      {
        label: "Scientific",
        command: "scientific",
        role: "menuitemradio",
        checked: false,
        disabled: true,
      },
      { separator: true },
      {
        label: "Digit grouping",
        command: "grouping",
        role: "menuitemcheckbox",
        checked: false,
      },
    ]),
    createMenu("Help", [
      { label: "Help Topics", command: "help-topics" },
      { separator: true },
      { label: "About Calculator", command: "about" },
    ]),
  ];
  menuBar.append(...menus);

  const closeMenus = () => {
    content.querySelectorAll(".xp-calculator-popup").forEach((popup) => {
      popup.hidden = true;
    });
    content
      .querySelectorAll(".xp-calculator-menu-trigger")
      .forEach((trigger) => {
        trigger.setAttribute("aria-expanded", "false");
      });
  };

  content.querySelectorAll(".xp-calculator-menu-trigger").forEach((trigger) => {
    trigger.addEventListener("click", () => {
      const popup = trigger.nextElementSibling;
      const open = popup.hidden;
      closeMenus();
      popup.hidden = !open;
      trigger.setAttribute("aria-expanded", String(open));
    });
  });

  content.querySelectorAll(".xp-calculator-popup button").forEach((button) => {
    button.addEventListener("click", async () => {
      closeMenus();
      if (button.dataset.command === "copy") {
        await navigator.clipboard?.writeText(entry);
      } else if (button.dataset.command === "paste") {
        const value = await navigator.clipboard?.readText();
        if (value && Number.isFinite(Number(value.trim()))) {
          entry = String(Number(value.trim()));
          replaceEntry = true;
          error = false;
          showEntry();
        }
      } else if (button.dataset.command === "help-topics") {
        context.dialogs.alert(
          "Use the number and operation buttons to perform a calculation.",
          "Calculator Help",
          "info",
        );
      } else if (button.dataset.command === "about") {
        context.dialogs.alert(
          "Microsoft Calculator\nVersion 5.1",
          "About Calculator",
          "info",
        );
      }
    });
  });

  const keyboardCommands = {
    Enter: "equals",
    "=": "equals",
    Escape: "clear",
    Backspace: "backspace",
    Delete: "clear-entry",
    "+": "add",
    "-": "subtract",
    "*": "multiply",
    "/": "divide",
    "%": "percent",
    ".": "decimal",
    ",": "decimal",
  };
  content.addEventListener("keydown", (event) => {
    const command = /^\d$/.test(event.key)
      ? event.key
      : keyboardCommands[event.key];
    if (!command) return;
    event.preventDefault();
    runCommand(command);
  });

  content.addEventListener("pointerdown", (event) => {
    if (!event.target.closest(".xp-calculator-menu-group")) closeMenus();
  });
  showEntry();
  return content;
};
