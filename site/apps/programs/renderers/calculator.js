import { createProgramRoot } from "../ui.js";

export const renderCalculator = (context, program, programId) => {
  const content = createProgramRoot(program);

  content.innerHTML = `<input class="xp-calculator-display" value="0" aria-label="Calculator display" readonly><div class="xp-calculator-keys" aria-label="Calculator keypad"></div>`;
  const display = content.querySelector(".xp-calculator-display");
  const keys = content.querySelector(".xp-calculator-keys");
  let accumulator = 0;
  let operator = null;
  let freshValue = true;
  const calculate = (value) => {
    if (operator === "+") accumulator += value;
    else if (operator === "−") accumulator -= value;
    else if (operator === "×") accumulator *= value;
    else if (operator === "÷")
      accumulator = value === 0 ? 0 : accumulator / value;
    else accumulator = value;
    display.value = String(Number(accumulator.toFixed(10)));
  };
  [
    "Back",
    "CE",
    "C",
    "7",
    "8",
    "9",
    "÷",
    "4",
    "5",
    "6",
    "×",
    "1",
    "2",
    "3",
    "−",
    "0",
    ".",
    "=",
    "+",
  ].forEach((label) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      if (/^\d$/.test(label) || label === ".") {
        display.value = freshValue
          ? label === "."
            ? "0."
            : label
          : `${display.value}${label}`;
        freshValue = false;
      } else if (label === "Back") {
        display.value =
          display.value.length > 1 ? display.value.slice(0, -1) : "0";
      } else if (label === "C" || label === "CE") {
        display.value = "0";
        if (label === "C") {
          accumulator = 0;
          operator = null;
        }
        freshValue = true;
      } else if (label === "=") {
        calculate(Number(display.value));
        operator = null;
        freshValue = true;
      } else {
        calculate(Number(display.value));
        operator = label;
        freshValue = true;
      }
    });
    keys.appendChild(button);
  });
  return content;
};
