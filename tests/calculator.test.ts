// @ts-nocheck -- Happy DOM's element types intentionally replace lib.dom here.
import { afterEach, describe, expect, test } from "bun:test";
import { cleanupShells, loadShell, login } from "./helpers/shell-harness";

afterEach(cleanupShells);

const launchCalculator = async () => {
  const shell = await login(await loadShell());
  shell.document.getElementById("start-button").click();
  shell.document.getElementById("all-programs-button").click();
  const flyouts = shell.document.getElementById("start-menu-flyouts");
  flyouts.querySelector('[data-program-id="accessories"]').click();
  flyouts.querySelector('[data-program-id="calculator"]').click();
  const calculator = shell.document.querySelector(
    '.xp-window[data-game="__calculator"]',
  );
  const display = calculator.querySelector(".xp-calculator-display");
  const press = (...labels) => {
    for (const label of labels) {
      [...calculator.querySelectorAll("button")]
        .find((button) => button.textContent === label)
        .click();
    }
  };
  return { shell, calculator, display, press };
};

describe("Windows XP Calculator", () => {
  test("matches the fixed standard-mode layout from XP", async () => {
    const { calculator, display } = await launchCalculator();

    expect(calculator.style.width).toBe("260px");
    expect(calculator.style.height).toBe("260px");
    expect(calculator.querySelector(".maximize-btn").disabled).toBeTrue();
    expect(display.value).toBe("0.");
    expect(
      [...calculator.querySelectorAll(".xp-calculator-menu-trigger")].map(
        (button) => button.textContent,
      ),
    ).toEqual(["Edit", "View", "Help"]);
    expect(
      [...calculator.querySelectorAll(".xp-calculator-keys button")].map(
        (button) => button.textContent,
      ),
    ).toEqual([
      "MC",
      "7",
      "8",
      "9",
      "/",
      "sqrt",
      "MR",
      "4",
      "5",
      "6",
      "*",
      "%",
      "MS",
      "1",
      "2",
      "3",
      "-",
      "1/x",
      "M+",
      "0",
      "+/-",
      ".",
      "+",
      "=",
    ]);
  });

  test("performs chained, repeated, percent, and unary calculations", async () => {
    const { display, press } = await launchCalculator();

    press("2", "+", "3", "=");
    expect(display.value).toBe("5.");
    press("=");
    expect(display.value).toBe("8.");
    press("C", "2", "0", "0", "+", "1", "0", "%", "=");
    expect(display.value).toBe("220.");
    press("C", "9", "sqrt");
    expect(display.value).toBe("3.");
    press("1/x");
    expect(display.value).toBe("0.333333333333333");
  });

  test("supports memory, correction controls, errors, and keyboard input", async () => {
    const { shell, calculator, display, press } = await launchCalculator();

    press("4", "2", "MS", "C", "MR");
    expect(display.value).toBe("42.");
    expect(
      calculator.querySelector(".xp-calculator-memory-indicator").textContent,
    ).toBe("M");
    press("MC");
    expect(
      calculator.querySelector(".xp-calculator-memory-indicator").textContent,
    ).toBe("");

    press("C", "8", "9", "Backspace");
    expect(display.value).toBe("8.");
    press("/", "0", "=");
    expect(display.value).toBe("Cannot divide by zero.");
    press("C");

    for (const key of ["6", "*", "7", "Enter"]) {
      calculator
        .querySelector(".xp-native-calculator")
        .dispatchEvent(
          new shell.window.KeyboardEvent("keydown", { key, bubbles: true }),
        );
    }
    expect(display.value).toBe("42.");
  });
});
