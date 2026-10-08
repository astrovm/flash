// @ts-nocheck -- Calculator's engine is untyped browser JavaScript.
import { describe, expect, test } from "bun:test";

import {
  createCalculator,
  formatDecimal,
  formatNumber,
  pasteCommands,
} from "../site/apps/calculator/engine.js";
import * as N from "../site/apps/calculator/numbers.js";

// Keys as calc.exe's keyboard spells them: digits, ".", operators, and
// command names separated by spaces.
const SYMBOLS = {
  ".": "point",
  "+": "add",
  "-": "sub",
  "*": "mul",
  "/": "div",
  "=": "equals",
  "(": "open",
  ")": "close",
  "%": "percent",
};
const commands = (keys) =>
  keys
    .split(" ")
    .filter(Boolean)
    .flatMap((token) =>
      /^[0-9.+\-*/=()%]+$/.test(token)
        ? [...token].map((character) =>
            /\d/.test(character) ? `digit${character}` : SYMBOLS[character],
          )
        : [token],
    );
const calculate = (keys, options = { scientific: true }) => {
  const calculator = createCalculator(options);
  commands(keys).forEach((command) => calculator.press(command));
  return calculator;
};
const shows = (keys, options) => calculate(keys, options).display;
const standard = (keys) => shows(keys, { scientific: false });

const n = (value) => {
  const [whole, decimals = ""] = String(value).split(".");
  return N.number(BigInt(whole + decimals), 1n, -decimals.length);
};
const text = (x) => formatDecimal(x);

describe("display", () => {
  test("rounds to 32 significant digits, half away from zero", () => {
    expect(shows("2/3=")).toBe("0.66666666666666666666666666666667");
    expect(shows("2 sign /3=")).toBe("-0.66666666666666666666666666666667");
    expect(shows("1/7=")).toBe("0.14285714285714285714285714285714");
    expect(shows("1/3*3=")).toBe("1.");
  });

  test("switches to scientific notation past 32 whole digits or 34 decimals", () => {
    expect(shows("10 pow 31=")).toBe("10000000000000000000000000000000.");
    expect(shows("10 pow 32=")).toBe("1.e+32");
    expect(shows("2 pow 107=")).toBe("1.6225927682921336339157801028813e+32");
    expect(shows("10 pow 34= reciprocal")).toBe(
      "0.0000000000000000000000000000000001",
    );
    expect(shows("10 pow 35= reciprocal")).toBe("1.e-35");
    expect(shows("3 pow 40= reciprocal")).toBe(
      "8.2252633399699590812820584006073e-20",
    );
    expect(shows("1 exp 9999")).toBe("1.e+9999");
  });

  test("rounding can carry into a new digit", () => {
    // 32 nines and a 5 round up to 10^32, which no longer fits.
    expect(text(n("99999999999999999999999999999999.5"))).toBe("1.e+32");
    expect(text(n("-99999999999999999999999999999999.5"))).toBe("-1.e+32");
    expect(text(n("0.999999999999999999999999999999999"))).toBe("1.");
    expect(
      formatDecimal(n("99999999999999999999999999999999.5"), { fe: true }),
    ).toBe("1.e+32");
  });

  test("F-E forces scientific notation, and C turns it off", () => {
    expect(shows("fe")).toBe("0.e+0");
    expect(shows("123 fe")).toBe("1.23e+2");
    expect(shows("0.5 fe")).toBe("5.e-1");
    expect(shows("123 fe clear 123=")).toBe("123.");
  });

  test("digit grouping", () => {
    const calculator = calculate("1234567.8912");
    calculator.setGrouping(true);
    expect(calculator.display).toBe("1,234,567.8912");
    calculator.press("sign");
    expect(calculator.display).toBe("-1,234,567.8912");
    calculator.press("add");
    expect(calculator.display).toBe("-1,234,567.8912");
    expect(formatNumber(n(65535), { radix: 16, grouping: true })).toBe("FFFF");
    expect(formatNumber(n(2 ** 36 - 1), { radix: 16, grouping: true })).toBe(
      "F FFFF FFFF",
    );
    expect(formatNumber(n(2097151), { radix: 8, grouping: true })).toBe(
      "7 777 777",
    );
    expect(formatNumber(n(511), { radix: 2, grouping: true })).toBe(
      "1 1111 1111",
    );
    expect(formatDecimal(n(123), { grouping: true })).toBe("123.");
  });
});

describe("number entry", () => {
  test("keeps what was typed until an operator", () => {
    expect(shows("1.50")).toBe("1.50");
    expect(shows(".5")).toBe("0.5");
    expect(shows("000 5")).toBe("5.");
    expect(shows("1.0 sign")).toBe("-1.0");
    expect(shows("1.50 +")).toBe("1.5");
  });

  test("takes 32 characters, the point included", () => {
    const digits = "1234567891".repeat(4);
    expect(shows(digits)).toBe(`${digits.slice(0, 32)}.`);
    expect(shows(`${"1".repeat(32)} . 2`)).toBe(`${"1".repeat(32)}.`);
    expect(shows(`5. ${"0".repeat(25)} 123456789`)).toBe(
      `5.${"0".repeat(25)}12345`,
    );
    expect(calculate(digits).beeps).toBe(8);
  });

  test("exponents take up to four digits", () => {
    expect(shows("1 exp")).toBe("1.e+0");
    expect(shows("1 exp 5")).toBe("1.e+5");
    expect(shows("1 exp 5 sign")).toBe("1.e-5");
    expect(shows("1 exp 5 =")).toBe("100000.");
    expect(shows("1 exp 2 sign =")).toBe("0.01");
    expect(shows("1 exp 0 5")).toBe("1.e+5");
    expect(calculate("1 exp 99999").beeps).toBe(1);
    expect(calculate("1 exp exp").beeps).toBe(1);
    expect(calculate("1 exp .").beeps).toBe(1);
    expect(calculate("1.5 .").beeps).toBe(1);
  });

  test("Backspace removes the last character, and only while typing", () => {
    expect(shows("123 back")).toBe("12.");
    expect(shows("1 exp 5 back")).toBe("1.e+0");
    expect(shows("1 exp 5 back back")).toBe("1.");
    expect(shows("1.5 back")).toBe("1.");
    expect(shows("1.5 back back")).toBe("1.");
    expect(shows("5 sign back")).toBe("0.");
    expect(shows("5 sign back 3")).toBe("3.");
    expect(calculate("back").beeps).toBe(1);
    expect(shows("12+3= back")).toBe("15.");
    expect(calculate("12+3= back").beeps).toBe(1);
    expect(calculate("12+3= exp").beeps).toBe(1);
  });

  test("zero takes no sign", () => {
    expect(shows("0 sign 5")).toBe("5.");
    expect(shows("sign")).toBe("0.");
    expect(shows("0.05 sign")).toBe("-0.05");
  });

  test("digits past the radix beep", () => {
    const calculator = calculate("digit10");
    expect(calculator.display).toBe("0.");
    expect(calculator.beeps).toBe(1);
    expect(shows("bin 1 2 1")).toBe("11");
  });
});

describe("arithmetic", () => {
  test("Standard works left to right; Scientific has precedence", () => {
    expect(standard("2+3*4=")).toBe("20.");
    expect(shows("2+3*4=")).toBe("14.");
    expect(shows("2*3+4*5=")).toBe("26.");
    expect(shows("2+3*4 pow 2=")).toBe("50.");
    expect(shows("1 or 2 and 3=")).toBe("3.");
    expect(shows("2+3*")).toBe("3.");
  });

  test("repeated equals repeat the last operation", () => {
    expect(shows("2+3==")).toBe("8.");
    expect(standard("5+==")).toBe("15.");
    expect(standard("10/==")).toBe("0.1");
    expect(standard("3-=")).toBe("0.");
    expect(shows("2+3=4=")).toBe("8.");
    expect(shows("2+3=*4=")).toBe("20.");
    expect(shows("2+3= inv square =")).toBe(
      "7.2360679774997896964091736687313",
    );
    expect(shows("2+3*=")).toBe("4.");
    expect(shows("2+3*==")).toBe("6.");
    expect(shows("2*3+=")).toBe("12.");
    expect(shows("5=")).toBe("5.");
    expect(shows("2+3*4-1=")).toBe("13.");
    expect(shows("1 exp =")).toBe("1.");
  });

  test("a second operator replaces the first", () => {
    expect(shows("2+-3=")).toBe("-1.");
    expect(shows("16 lsh inv lsh 2=")).toBe("4.");
  });

  test("a function after an operator works on the number before it", () => {
    expect(standard("4+ sqrt =")).toBe("6.");
  });

  test("percent takes a share of the number before", () => {
    expect(standard("200+10%")).toBe("20.");
    expect(standard("200+10%=")).toBe("220.");
    expect(standard("50%")).toBe("0.");
    expect(standard("10*50%=")).toBe("50.");
  });

  test("errors lock the display until C or CE", () => {
    expect(shows("1/0=")).toBe("Cannot divide by zero.");
    expect(shows("0/0=")).toBe("Result of function is undefined.");
    expect(shows("1/0= 5 +")).toBe("Cannot divide by zero.");
    expect(calculate("1/0= 5").beeps).toBe(1);
    expect(shows("1/0= clearEntry")).toBe("0.");
    expect(shows("1/0= clear 2+2=")).toBe("4.");
    expect(shows("5 mod 0=")).toBe("Cannot divide by zero.");
    expect(shows("0 mod 0=")).toBe("Cannot divide by zero.");
    expect(shows("1/0+2=")).toBe("Cannot divide by zero.");
    expect(shows("1/0*2")).toBe("Cannot divide by zero.");
    expect(shows("( 1/0 )")).toBe("Cannot divide by zero.");
  });

  test("CE clears the entry, Inv and Hyp; C clears everything", () => {
    const calculator = calculate("2+3 inv hyp clearEntry 4=");
    expect(calculator.display).toBe("6.");
    expect(calculator.inv).toBe(false);
    expect(calculator.hyp).toBe(false);
    expect(shows("2+3 clear =")).toBe("0.");
    const standardInv = createCalculator();
    standardInv.press("inv");
    standardInv.press("clearEntry");
    expect(standardInv.inv).toBe(true);
  });

  test("sign flips a result", () => {
    expect(shows("2+3= sign")).toBe("-5.");
    expect(shows("hex 1= sign")).toBe("FFFFFFFFFFFFFFFF");
  });

  test("mod keeps the dividend's sign; bit shifts", () => {
    expect(shows("7 sign mod 3=")).toBe("-1.");
    expect(shows("7.5 mod 2=")).toBe("1.5");
    expect(shows("1 lsh 3=")).toBe("8.");
    expect(shows("16 inv lsh 2=")).toBe("4.");
    expect(shows("5.4 lsh 0=")).toBe("5.");
    expect(shows("1 lsh 1 exp 30=")).toBe("Invalid input for function.");
    expect(shows("1 lsh 5 sign =")).toBe("0.");
  });

  test("decimal And, Or and Xor work digit by digit, like ratpak", () => {
    expect(shows("12 and 7=")).toBe("4.");
    expect(shows("5.9 and 3=")).toBe("2.");
    expect(shows("12.5 or 0=")).toBe("120.");
    expect(shows("123.45 or 0=")).toBe("12300.");
    expect(shows("0 or 2.5=")).toBe("2.");
    expect(shows("2.5 or 2=")).toBe("22.");
    expect(shows("2.5 or 2.5=")).toBe("2.");
    expect(shows("2.25 or 1.5=")).toBe("20.2");
    expect(shows("5.4 xor 0=")).toBe("50.");
    expect(shows("5 sign and 7=")).toBe("5.");
    expect(shows("3 or 1 sign =")).toBe("-3.");
    expect(shows("7/3= or 0=")).toBe("2.e+32");
  });

  test("Not", () => {
    expect(shows("5 not")).toBe("-6.");
    expect(shows("5 sign not")).toBe("4.");
    expect(shows("2.5 sign not")).toBe("1.");
    expect(shows("hex 0 not")).toBe("FFFFFFFFFFFFFFFF");
    expect(shows("hex byte 0 not")).toBe("FF");
  });
});

describe("parentheses", () => {
  test("group and show their depth", () => {
    expect(shows("( 2+3 ) *4=")).toBe("20.");
    expect(shows("(")).toBe("(");
    expect(shows("( (")).toBe("((");
    expect(calculate("( (").parentheses).toBe(2);
    expect(shows("( 3")).toBe("3.");
    expect(shows("( 3 )")).toBe("3.");
    expect(shows("2+3 ( 4 ) =")).toBe("6.");
    expect(shows("5 ( )")).toBe("5.");
    expect(shows("2* ( 3+4 ) =")).toBe("14.");
    expect(shows("( 2+3*4 )")).toBe("14.");
    expect(shows("2* ( 1/0=")).toBe("Cannot divide by zero.");
  });

  test("equals inside parentheses stops at them", () => {
    expect(shows("2* ( 3+4=")).toBe("7.");
    expect(shows("2* ( 3+4= ) =")).toBe("14.");
  });

  test("limits", () => {
    expect(calculate("5 )").beeps).toBe(1);
    expect(calculate("( ".repeat(26)).beeps).toBe(1);
    expect(calculate("( ".repeat(26)).parentheses).toBe(25);
    // 25 pending lower-precedence operators fill the queue.
    const queued = calculate(`${"( ".repeat(24)} 1+2*3 pow 2`);
    expect(queued.beeps).toBe(1);
    queued.press("open");
    expect(queued.beeps).toBe(2);
    expect(standard("( 2+3 ) *4=")).toBe("20.");
  });
});

describe("functions", () => {
  test("Standard's square root, reciprocal and the @ key", () => {
    expect(standard("9 square")).toBe("3.");
    expect(standard("9 sqrt")).toBe("3.");
    expect(standard("4 reciprocal")).toBe("0.25");
    expect(standard("4 sqrt -2=")).toBe("0.");
    expect(standard("0 reciprocal")).toBe("Cannot divide by zero.");
  });

  test("powers and roots", () => {
    expect(shows("1 sign square")).toBe("1.");
    expect(shows("1 sign inv square")).toBe("Invalid input for function.");
    expect(shows("3 cube")).toBe("27.");
    expect(shows("27 inv cube")).toBe("3.");
    expect(shows("8 sign inv cube")).toBe("Invalid input for function.");
    expect(shows("8 inv pow 3=")).toBe("2.");
    expect(shows("8 sign inv pow 3=")).toBe("Invalid input for function.");
    expect(shows("8 inv pow 0=")).toBe("Cannot divide by zero.");
    expect(shows("0 pow 0=")).toBe("1.");
    expect(shows("0 pow 2=")).toBe("0.");
    expect(shows("0 pow 1 sign =")).toBe("Invalid input for function.");
    expect(shows("0 pow 0.5=")).toBe("0.");
    expect(shows("2 pow 0.5=")).toBe("1.4142135623730950488016887242097");
    expect(shows("4 pow 0.5 sign =")).toBe("0.5");
    expect(shows("0.04 pow 0.5=")).toBe("0.2");
    expect(shows("0.4 pow 0.5=")).toBe("0.63245553203367586639977870888654");
    expect(shows("2 pow 3 sign =")).toBe("0.125");
    expect(shows("10 pow 100000=")).toBe("Invalid input for function.");
    expect(shows("2 sign pow 333333=")).toBe("Invalid input for function.");
    expect(shows("0.1 pow 100000=")).toBe("0.");
    expect(shows("1 sign pow 1 exp 30=")).toBe("1.");
    expect(shows("1.5 pow 2.5=")).toBe("2.7556759606310753604719445840441");
  });

  test("logarithms", () => {
    expect(shows("1000 log")).toBe("3.");
    expect(shows("2 log")).toBe("0.30102999566398119521373889472449");
    expect(shows("3 inv log")).toBe("1000.");
    expect(shows("10 ln")).toBe("2.3025850929940456840179914546844");
    expect(shows("3 reciprocal ln")).toBe("-1.0986122886681096913952452369225");
    expect(shows("1 inv ln")).toBe("2.7182818284590452353602874713527");
    expect(shows("0 ln")).toBe("Invalid input for function.");
    expect(shows("0 log")).toBe("Invalid input for function.");
    expect(shows("1 sign ln")).toBe("Invalid input for function.");
    expect(shows("1 exp 9999 ln")).toBe("23023.548344847462794495896555389");
    expect(shows("1 exp 6 inv ln")).toBe("Invalid input for function.");
    expect(shows("1 exp 6 = sign inv ln")).toBe("0.");
  });

  test("trigonometry in degrees, radians and grads", () => {
    expect(shows("30 sin")).toBe("0.5");
    expect(shows("180 sin")).toBe("0.");
    expect(shows("390 sin")).toBe("0.5");
    expect(shows("30 sign sin")).toBe("-0.5");
    expect(shows("45 sin")).toBe("0.70710678118654752440084436210485");
    expect(shows("90 cos")).toBe("0.");
    expect(shows("60 cos")).toBe("0.5");
    expect(shows("60 sin")).toBe("0.86602540378443864676372317075294");
    expect(shows("radians pi /2= cos")).toBe("0.");
    expect(shows("45 cos")).toBe("0.70710678118654752440084436210485");
    expect(shows("90 tan")).toBe("Invalid input for function.");
    expect(shows("180 tan")).toBe("0.");
    expect(shows("45 tan")).toBe("1.");
    expect(shows("radians pi sin")).toBe("0.");
    expect(shows("radians 1 sin")).toBe("0.8414709848078965066525023216303");
    expect(shows("radians 1 cos")).toBe("0.54030230586813971740093660744298");
    expect(shows("radians 1 tan")).toBe("1.5574077246549022305069748074584");
    expect(shows("radians pi /2= tan")).toBe("Invalid input for function.");
    expect(shows("grads 100 sin")).toBe("1.");
    expect(shows("grads 50 sin")).toBe("0.70710678118654752440084436210485");
  });

  test("inverse trigonometry", () => {
    expect(shows("2 inv sin")).toBe("Invalid input for function.");
    expect(shows("1 inv sin")).toBe("90.");
    expect(shows("1 sign inv sin")).toBe("-90.");
    expect(shows("0.5 inv sin")).toBe("30.");
    expect(shows("1 inv cos")).toBe("0.");
    expect(shows("1 sign inv cos")).toBe("180.");
    expect(shows("0.5 inv cos")).toBe("60.");
    expect(shows("1 inv tan")).toBe("45.");
    expect(shows("1 exp 40 inv tan")).toBe("90.");
    expect(shows("1 exp 40 = sign inv tan")).toBe("-90.");
    expect(shows("radians 1 inv sin")).toBe(
      "1.5707963267948966192313216916398",
    );
    expect(shows("grads 1 inv sin")).toBe("100.");
  });

  test("hyperbolic functions, and Inv and Hyp reset after use", () => {
    expect(shows("1 hyp sin")).toBe("1.1752011936438014568823818505956");
    expect(shows("1 sign hyp sin")).toBe("-1.1752011936438014568823818505956");
    expect(shows("1 hyp cos")).toBe("1.5430806348152437784779056207571");
    expect(shows("1 hyp tan")).toBe("0.76159415595576488811945828260479");
    expect(shows("300 hyp tan")).toBe("1.");
    expect(shows("300 sign hyp tan")).toBe("-1.");
    expect(shows("1 inv hyp sin")).toBe("0.88137358701954302523260932497979");
    expect(shows("1 sign inv hyp sin")).toBe(
      "-0.88137358701954302523260932497979",
    );
    expect(shows("2 inv hyp cos")).toBe("1.316957896924816708625046347308");
    expect(shows("0.5 inv hyp cos")).toBe("Invalid input for function.");
    expect(shows("0.5 inv hyp tan")).toBe("0.54930614433405484569762261846126");
    expect(shows("1 inv hyp tan")).toBe("Invalid input for function.");
    const calculator = calculate("1 inv hyp sin");
    expect(calculator.inv).toBe(false);
    expect(calculator.hyp).toBe(false);
    const kept = calculate("4 inv hyp reciprocal");
    expect(kept.inv).toBe(true);
    expect(kept.hyp).toBe(true);
  });

  test("factorial and the gamma function", () => {
    expect(shows("0 factorial")).toBe("1.");
    expect(shows("5 factorial")).toBe("120.");
    expect(shows("171 factorial")).toBe(
      "1.2410180702176678234248405241031e+309",
    );
    expect(shows("3.5 factorial")).toBe("11.631728396567448929144224109426");
    expect(shows("2.5 factorial")).toBe("3.3233509704478425511840640312646");
    expect(shows("0.5 sign factorial")).toBe(
      "1.7724538509055160272981674833411",
    );
    expect(shows("1.5 sign factorial")).toBe(
      "-3.5449077018110320545963349666823",
    );
    expect(shows("60.5 factorial")).toBe(
      "6.4855950590872362691527350244497e+82",
    );
    expect(shows("1 sign factorial")).toBe("Invalid input for function.");
    expect(shows("30000 factorial")).toBe("Invalid input for function.");
    expect(shows("30000.5 factorial")).toBe("Invalid input for function.");
  });

  test("Int, dms and pi", () => {
    expect(shows("2.7 semicolon")).toBe("2.7");
    expect(shows("2.7 int")).toBe("2.");
    expect(shows("2.7 inv int")).toBe("0.7");
    expect(shows("2.7 sign inv int")).toBe("-0.7");
    expect(shows("1.5 dms")).toBe("1.3");
    expect(shows("1.3 inv dms")).toBe("1.5");
    expect(shows("1.2525 dms")).toBe("1.1509");
    expect(shows("pi")).toBe("3.1415926535897932384626433832795");
    expect(shows("inv pi")).toBe("6.283185307179586476925286766559");
    expect(calculate("inv pi").inv).toBe(false);
  });
});

describe("hex, octal and binary", () => {
  test("convert, truncate and wrap to the word size", () => {
    expect(shows("255 hex")).toBe("FF");
    expect(shows("hex 1 sign")).toBe("-1");
    expect(shows("hex 1 sign dword")).toBe("FFFFFFFF");
    expect(shows("hex 1 sign dword word byte qword dec")).toBe("255.");
    expect(shows("2.5 hex dec")).toBe("2.");
    expect(shows("2.5 sign hex")).toBe("FFFFFFFFFFFFFFFE");
    expect(shows("2.5 sign hex dec")).toBe("18446744073709551614.");
    expect(shows("hex 7/2=")).toBe("3");
    expect(shows("hex 1-2=")).toBe("FFFFFFFFFFFFFFFF");
    expect(shows("hex 2 reciprocal")).toBe("0");
    expect(shows("hex 5 factorial")).toBe("78");
    expect(shows("hex digit15 and digit12 =")).toBe("C");
    expect(shows("hex digit10 or 5 =")).toBe("F");
    expect(shows("hex digit15 xor 5 =")).toBe("A");
    expect(shows("hex 1 lsh 4 0 =")).toBe("0");
    expect(shows("hex 8 inv lsh 2 =")).toBe("2");
    expect(shows("hex 3 pow 2 =")).toBe("9");
    expect(shows("hex 8 inv pow 3 =")).toBe("2");
    expect(shows("oct 8")).toBe("0");
    expect(shows("dec 8 oct")).toBe("10");
    expect(shows("5 bin")).toBe("101");
  });

  test("limit typing to the word size", () => {
    expect(shows(`hex ${"digit15 ".repeat(20)}`)).toBe("F".repeat(16));
    expect(shows(`oct ${"7".repeat(25)}`)).toBe("7".repeat(21));
    expect(shows(`bin ${"1".repeat(70)}`)).toBe("1".repeat(64));
    expect(shows("oct byte 777")).toBe("77");
    expect(shows(`bin byte ${"1".repeat(9)}`)).toBe("11111111");
  });

  test("F2 to F4 pick word sizes; decimal-only keys beep", () => {
    const calculator = calculate("hex degrees");
    expect(calculator.bits).toBe(32);
    calculator.press("radians");
    expect(calculator.bits).toBe(16);
    calculator.press("grads");
    expect(calculator.bits).toBe(8);
    expect(calculator.angle).toBe("degrees");
    for (const command of ["sin", "dms", "pi", "point", "exp"])
      expect(calculate(`hex 5 ${command}`).beeps).toBe(1);
    expect(shows("hex 5 sin")).toBe("5");
    expect(shows("hex 5 fe")).toBe("5");
    expect(shows("qword dec 5")).toBe("5.");
    const word = calculate("word");
    expect(word.bits).toBe(16);
    expect(word.radix).toBe(10);
  });

  test("Standard stays decimal", () => {
    expect(standard("255 hex")).toBe("255.");
    const calculator = calculate("255 hex inv hyp");
    calculator.setScientific(false);
    expect(calculator.radix).toBe(10);
    expect(calculator.display).toBe("255.");
    expect(calculator.inv).toBe(false);
    const decimal = calculate("5");
    decimal.setScientific(false);
    expect(decimal.display).toBe("5.");
    decimal.setScientific(true);
    decimal.press("hex");
    expect(decimal.display).toBe("5");
  });
});

describe("memory", () => {
  test("MS, MR, M+ and MC", () => {
    const calculator = calculate("5 ms");
    expect(calculator.memory).toBe(true);
    calculator.press("clear");
    expect(calculator.memory).toBe(true);
    commands("2 mplus mr").forEach((command) => calculator.press(command));
    expect(calculator.display).toBe("7.");
    commands("7 sign mplus").forEach((command) => calculator.press(command));
    expect(calculator.memory).toBe(false);
    commands("3 ms mc mr").forEach((command) => calculator.press(command));
    expect(calculator.memory).toBe(false);
    expect(calculator.display).toBe("0.");
    expect(shows("5 ms 3+ mr =")).toBe("8.");
    expect(calculate("0 ms").memory).toBe(false);
    expect(shows("hex 1 sign ms dec mr")).toBe("18446744073709551615.");
  });
});

describe("statistics", () => {
  const box = (keys) => {
    const calculator = createCalculator({ scientific: true });
    calculator.press("sta");
    commands(keys).forEach((command) => calculator.press(command));
    return calculator;
  };

  test("need the Statistics Box", () => {
    const calculator = calculate("5 inv dat");
    expect(calculator.beeps).toBe(1);
    expect(calculator.inv).toBe(false);
  });

  test("Ave, Sum and s, with Inv for squares and the population", () => {
    const data = "1 dat 2 dat 3 dat 4.5 dat";
    expect(box(data).statistics).toEqual(["1.", "2.", "3.", "4.5"]);
    expect(box(`${data} ave`).display).toBe("2.625");
    expect(box(`${data} sum`).display).toBe("10.5");
    expect(box(`${data} s`).display).toBe("1.4930394055974097653871929250543");
    expect(box(`${data} inv ave`).display).toBe("8.5625");
    expect(box(`${data} inv sum`).display).toBe("34.25");
    expect(box(`${data} inv s`).display).toBe(
      "1.2930100540985750587173249303284",
    );
    expect(box(`${data} inv s`).inv).toBe(false);
  });

  test("empty and single lists", () => {
    expect(box("ave").display).toBe("Cannot divide by zero.");
    expect(box("sum").display).toBe("0.");
    expect(box("5 dat s").display).toBe("0.");
  });

  test("the box loads, removes and clears values", () => {
    const calculator = box("1 dat 2 dat 3 dat");
    calculator.loadStatistic(1);
    expect(calculator.display).toBe("2.");
    calculator.removeStatistic(0);
    expect(calculator.statistics).toEqual(["2.", "3."]);
    calculator.clearStatistics();
    expect(calculator.statistics).toEqual([]);
    const failed = box("1 dat 1/0=");
    failed.loadStatistic(0);
    expect(failed.display).toBe("Cannot divide by zero.");
    const hex = box("255 dat hex");
    hex.loadStatistic(0);
    expect(hex.display).toBe("FF");
    expect(box("hex digit15 dat").statistics).toEqual(["F"]);
  });
});

describe("state", () => {
  test("grouping redraws the entry, a result, or keeps an error", () => {
    const calculator = calculate("1234");
    calculator.setGrouping(true);
    expect(calculator.display).toBe("1,234.");
    calculator.press("equals");
    calculator.setGrouping(false);
    expect(calculator.display).toBe("1234.");
    const failed = calculate("1/0=");
    failed.setGrouping(true);
    expect(failed.display).toBe("Cannot divide by zero.");
    const typing = calculate("1/0= clearEntry");
    typing.setGrouping(true);
    expect(typing.display).toBe("0.");
  });

  test("reports its modes", () => {
    const calculator = calculate("radians inv hyp");
    expect(calculator.angle).toBe("radians");
    expect(calculator.inv).toBe(true);
    expect(calculator.hyp).toBe(true);
    expect(calculator.radix).toBe(10);
    expect(calculator.error).toBe(null);
    expect(calculate("1/0=").error).toBe("divide");
    expect(N.compare(calculate("2+3=").value, N.integer(5))).toBe(0);
  });
});

describe("paste", () => {
  test("reads the clipboard as key presses", () => {
    expect(pasteCommands("2+3=", 10)).toEqual([
      "digit2",
      "add",
      "digit3",
      "equals",
    ]);
    expect(pasteCommands(" 1,234\r\n.5", 10)).toEqual([
      "digit1",
      "digit2",
      "digit3",
      "digit4",
      "point",
      "digit5",
    ]);
    expect(pasteCommands("-5", 10)).toEqual(["digit5", "sign"]);
    expect(pasteCommands("-05", 10)).toEqual(["digit0", "digit5", "sign"]);
    expect(pasteCommands("1e-5", 10)).toEqual([
      "digit1",
      "exp",
      "sign",
      "digit5",
    ]);
    expect(pasteCommands("1E+5", 10)).toEqual(["digit1", "exp", "digit5"]);
    expect(pasteCommands("1e5", 16)).toEqual(["digit1", "digit14", "digit5"]);
    expect(pasteCommands("ff", 16)).toEqual(["digit15", "digit15"]);
    expect(pasteCommands(":m:c:5:q", 10)).toEqual(["ms", "mc", "hex", "clear"]);
    expect(pasteCommands("3!", 10)).toEqual(["digit3", "factorial"]);
    expect(pasteCommands("m", 10)).toEqual(["degrees"]);
  });

  test("stops at the first character calc.exe has no key for", () => {
    expect(pasteCommands("12😀3", 10)).toEqual(["digit1", "digit2"]);
    expect(pasteCommands("١٢٣", 10)).toEqual([]);
    expect(pasteCommands("12ñ3", 10)).toEqual(["digit1", "digit2"]);
    expect(pasteCommands("hello", 10)).toEqual([
      "hyp",
      "exp",
      "log",
      "log",
      "cos",
    ]);
    expect(pasteCommands("", 10)).toEqual([]);
  });
});

describe("numbers", () => {
  test("long numbers round to 100 digits", () => {
    const big = N.number(2n ** 800n);
    expect(big.d).toBe(1n);
    expect(N.toBigInt(big)).toBeGreaterThan(10n ** 240n);
    const small = N.number(1n, 3n ** 600n);
    expect(N.sign(small)).toBe(1);
    expect(N.magnitudeOf(small)).toBe(-287);
  });

  test("far smaller addends vanish", () => {
    const big = N.number(1n, 1n, 200);
    expect(N.add(big, N.integer(1))).toBe(big);
    expect(N.add(N.integer(1), big)).toBe(big);
    expect(N.add(N.ZERO, big)).toBe(big);
  });

  test("magnitude limits", () => {
    expect(() => N.number(1n, 1n, 100000)).toThrow(
      "Invalid input for function.",
    );
    expect(N.number(1n, 1n, -100001)).toBe(N.ZERO);
    expect(N.decimalPlaces(N.number(1n, 3n), 5)).toBe(5);
    expect(N.isInteger(N.number(5n, 1n, 3))).toBe(true);
    expect(N.absolute(N.integer(-3)).n).toBe(3n);
  });

  test("functions take radians as plain fixed point", () => {
    expect(text(N.atan(N.integer(1), "radians"))).toBe(
      "0.78539816339744830961566084581988",
    );
    expect(text(N.acos(N.integer(0), "radians"))).toBe(
      "1.5707963267948966192313216916398",
    );
  });
});
