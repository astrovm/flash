// Calculator numbers, kept the way calc.exe's ratpak keeps them: exact
// fractions for arithmetic, so 1/3*3 is exactly 1, and 32 significant
// digits on the display. Irrational results (roots, logarithms,
// trigonometry, the gamma function) are worked out to 72 digits and kept
// as fractions too.

export const PRECISION = 32;
// Digits behind the point for irrational results.
const DIGITS = 72;
const SCALE = 10n ** BigInt(DIGITS);
// Fractions whose numerator and denominator both pass this many digits are
// rounded back to about 80 significant digits, as ratpak trims its own.
const TRIM_DIGITS = 120;
// ratpak refuses e^x beyond this, so 10^100000 is invalid input.
const MAX_EXPONENT = 100000;

export class CalcError extends Error {
  // "divide": Cannot divide by zero. "domain": Invalid input for function.
  // "undefined": Result of function is undefined.
  constructor(code) {
    super(code);
    this.code = code;
  }
}

const fail = (code) => {
  throw new CalcError(code);
};

const absolute = (value) => (value < 0n ? -value : value);
const lengthOf = (value) => absolute(value).toString().length;
const greatestDivisor = (a, b) => {
  while (b) [a, b] = [b, a % b];
  return a;
};
// Rounds a / b to the nearest integer, halves away from zero. b > 0.
const roundDivide = (a, b) => {
  const quotient = (absolute(a) * 2n + b) / (b * 2n);
  return a < 0n ? -quotient : quotient;
};

const reduce = (n, d) => {
  if (d < 0n) {
    n = -n;
    d = -d;
  }
  const divisor = greatestDivisor(absolute(n), d);
  return { n: n / divisor, d: d / divisor };
};

// m / 10^k, for either sign of k.
const fromScaled = (m, k) =>
  k >= 0 ? reduce(m, 10n ** BigInt(k)) : { n: m * 10n ** BigInt(-k), d: 1n };

export const make = (n, d = 1n) => {
  const value = reduce(n, d);
  if (Math.min(lengthOf(value.n), lengthOf(value.d)) <= TRIM_DIGITS)
    return value;
  const shift = DIGITS + 8 - (lengthOf(value.n) - lengthOf(value.d));
  return reduce(roundDivide(value.n * 10n ** BigInt(shift), value.d), 10n ** BigInt(shift));
};

export const ZERO = { n: 0n, d: 1n };
export const ONE = { n: 1n, d: 1n };
export const fromInteger = (value) => ({ n: BigInt(value), d: 1n });

export const isZero = (a) => a.n === 0n;
export const isInteger = (a) => a.d === 1n;
export const isNegative = (a) => a.n < 0n;
export const equals = (a, b) => a.n === b.n && a.d === b.d;
export const compare = (a, b) => {
  const difference = a.n * b.d - b.n * a.d;
  return difference > 0n ? 1 : difference < 0n ? -1 : 0;
};

export const negate = (a) => ({ n: -a.n, d: a.d });
export const add = (a, b) => make(a.n * b.d + b.n * a.d, a.d * b.d);
export const subtract = (a, b) => add(a, negate(b));
export const multiply = (a, b) => make(a.n * b.n, a.d * b.d);
export const divide = (a, b) => {
  if (isZero(b)) fail(isZero(a) ? "undefined" : "divide");
  return make(a.n * b.d, a.d * b.n);
};
// Toward zero, as ratpak's intrat does.
export const truncate = (a) => ({ n: a.n / a.d, d: 1n });
export const fraction = (a) => subtract(a, truncate(a));
// The remainder takes the dividend's sign: -7 Mod 3 is -1.
export const modulo = (a, b) =>
  subtract(a, multiply(b, truncate(divide(a, b))));

// ---- Fixed point: value * 10^DIGITS as a BigInt ----

const toFixed = (a, digits = DIGITS) =>
  roundDivide(a.n * 10n ** BigInt(digits), a.d);
const fromFixed = (m) => make(m, SCALE);
const fixedMultiply = (a, b) => roundDivide(a * b, SCALE);
const fixedDivide = (a, b) => roundDivide(a * SCALE, b);
// Rounds away the last few digits of noise, so log 100 is exactly 2.
const settle = (m, digits = DIGITS - 12) =>
  fromScaled(roundDivide(m, 10n ** BigInt(DIGITS - digits)), digits);
// ratpak works trigonometry to 32 places after the point: sin 1 degree
// shows 0.01745240643728351281941897851632, sin 30 exactly 0.5.
const settleAngle = (m) => settle(m, PRECISION);

// Sum of a series whose terms come from next(term, index) until they vanish.
const series = (first, next) => {
  let sum = 0n;
  let term = first;
  for (let index = 1; term; index += 1) {
    sum += term;
    term = next(term, index);
  }
  return sum;
};

// atanh(z) and atan(z) for fixed |z| well below 1.
const atanhSeries = (z) => {
  const square = fixedMultiply(z, z);
  let power = z;
  return series(z, (_, index) => {
    power = fixedMultiply(power, square);
    return power / BigInt(index * 2 + 1);
  });
};
const atanSeries = (z) => {
  const square = fixedMultiply(z, z);
  let power = z;
  return series(z, (_, index) => {
    power = -fixedMultiply(power, square);
    return power / BigInt(index * 2 + 1);
  });
};

let constants = null;
const getConstants = () => {
  if (constants) return constants;
  const inverse = (k) => SCALE / BigInt(k);
  constants = {
    ln2: atanhSeries(inverse(3)) * 2n,
    pi: atanSeries(inverse(5)) * 16n - atanSeries(inverse(239)) * 4n,
  };
  return constants;
};

const bitLength = (value) => value.toString(2).length;

// ln for a positive fraction, as a fixed value: a = y * 2^k with y near 1.
const lnFixed = (a) => {
  const k = bitLength(a.n) - bitLength(a.d);
  const n = k < 0 ? a.n << BigInt(-k) : a.n;
  const d = k > 0 ? a.d << BigInt(k) : a.d;
  const z = roundDivide((n - d) * SCALE, n + d);
  return atanhSeries(z) * 2n + BigInt(k) * getConstants().ln2;
};

export const ln = (a) => {
  if (a.n <= 0n) fail("domain");
  return settle(lnFixed(a));
};

export const log = (a) => {
  if (a.n <= 0n) fail("domain");
  return settle(fixedDivide(lnFixed(a), lnFixed(fromInteger(10))));
};

export const exp = (a) => {
  if (compare(absoluteOf(a), fromInteger(MAX_EXPONENT)) > 0) fail("domain");
  const { ln2 } = getConstants();
  const x = toFixed(a);
  const k = roundDivide(x, ln2);
  // e^r for |r| <= ln2 / 2, from r / 1024 squared ten times.
  const r = (x - k * ln2) / 1024n;
  let value = series(SCALE, (term, index) =>
    roundDivide(term * r, SCALE * BigInt(index)),
  );
  for (let step = 0; step < 10; step += 1)
    value = fixedMultiply(value, value);
  return k >= 0n
    ? make(value << k, SCALE)
    : make(value, SCALE << -k);
};

const absoluteOf = (a) => (isNegative(a) ? negate(a) : a);

// The integer q-th root of a non-negative BigInt, rounded down.
const integerRoot = (value, q) => {
  if (value < 2n) return value;
  const degree = BigInt(q);
  let x = 1n << BigInt(Math.ceil(bitLength(value) / q));
  for (;;) {
    const next = ((degree - 1n) * x + value / x ** (degree - 1n)) / degree;
    if (next >= x) return x;
    x = next;
  }
};

// The exact q-th root of a non-negative fraction, or null.
const exactRoot = (a, q) => {
  const n = integerRoot(a.n, q);
  const d = integerRoot(a.d, q);
  return n ** BigInt(q) === a.n && d ** BigInt(q) === a.d ? { n, d } : null;
};

// a^p for an integer p, exact when the result stays a reasonable size.
const integerPower = (a, p) => {
  if (isZero(a)) {
    if (p < 0n) fail("divide");
    return p === 0n ? ONE : ZERO;
  }
  const size = (lengthOf(a.n) + lengthOf(a.d)) * Number(absolute(p));
  if (size > 60000) return exp(multiply(fromInteger(p), ln(absoluteOf(a))));
  const n = a.n ** absolute(p);
  const d = a.d ** absolute(p);
  return p < 0n ? make(d, n) : make(n, d);
};

export const power = (a, b) => {
  if (isInteger(b)) {
    const result = integerPower(a, b.n);
    if (isNegative(a) && b.n % 2n) return negate(absoluteOf(result));
    return result;
  }
  if (isZero(a)) {
    if (isNegative(b)) fail("divide");
    return ZERO;
  }
  // A fraction with a small odd denominator takes an exact or odd root.
  if (b.d <= 1000n && (!isNegative(a) || b.d % 2n)) {
    const root = exactRoot(absoluteOf(a), Number(b.d));
    if (root) {
      const value = integerPower(root, b.n);
      return isNegative(a) && b.n % 2n ? negate(value) : value;
    }
  }
  if (isNegative(a)) {
    if (b.d % 2n === 0n) fail("domain");
    const value = power(negate(a), b);
    return b.n % 2n ? negate(value) : value;
  }
  return exp(multiply(b, ln(a)));
};

// Inv x^y: the y-th root.
export const root = (a, b) => {
  if (isZero(b)) fail("divide");
  const inverse = divide(ONE, b);
  if (isNegative(a) && !(isInteger(b) && b.n % 2n)) fail("domain");
  return power(a, inverse);
};

export const squareRoot = (a) => root(a, fromInteger(2));

// ---- Trigonometry ----

// sin and cos of a fixed angle in radians, already within [-pi, pi].
const sineCosine = (x) => {
  const t = x / 256n;
  const square = fixedMultiply(t, t);
  let sine = series(t, (term, index) =>
    roundDivide(-term * square, SCALE * BigInt(index * 2 * (index * 2 + 1))),
  );
  let cosine = series(SCALE, (term, index) =>
    roundDivide(-term * square, SCALE * BigInt((index * 2 - 1) * index * 2)),
  );
  for (let step = 0; step < 8; step += 1)
    [sine, cosine] = [
      fixedMultiply(sine, cosine) * 2n,
      fixedMultiply(cosine, cosine) * 2n - SCALE,
    ];
  return { sine, cosine };
};

// The angle in radians, reduced to [-pi, pi]. Degrees and grads reduce
// exactly first, so whole turns cost no precision.
const UNITS = { degrees: 180n, radians: 0n, grads: 200n };
const toRadians = (a, unit) => {
  const { pi } = getConstants();
  if (UNITS[unit]) {
    const half = fromInteger(UNITS[unit]);
    let turn = modulo(a, multiply(half, fromInteger(2)));
    if (compare(absoluteOf(turn), half) > 0)
      turn = subtract(turn, multiply(half, fromInteger(isNegative(turn) ? -2 : 2)));
    return roundDivide(toFixed(turn) * pi, toFixed(half));
  }
  // Radians reduce with 40 more digits of pi.
  const extra = 10n ** 40n;
  const precisePi = getPrecisePi();
  const x = toFixed(a, DIGITS + 40);
  const turns = roundDivide(x, precisePi * 2n);
  return roundDivide(x - turns * precisePi * 2n, extra);
};

let precisePiCache = null;
const getPrecisePi = () => {
  if (precisePiCache) return precisePiCache;
  const scale = 10n ** BigInt(DIGITS + 60);
  const arctangent = (k) => {
    const inverse = scale / k;
    const square = k * k;
    let power = inverse;
    let sum = 0n;
    for (let index = 0n; power; index += 1n) {
      sum += (index % 2n ? -power : power) / (index * 2n + 1n);
      power /= square;
    }
    return sum;
  };
  precisePiCache =
    (arctangent(5n) * 16n - arctangent(239n) * 4n) / 10n ** 20n;
  return precisePiCache;
};

const fromRadians = (x, unit) => {
  const { pi } = getConstants();
  if (!UNITS[unit]) return x;
  return roundDivide(x * UNITS[unit] * SCALE, pi);
};

export const sin = (a, unit) =>
  settleAngle(sineCosine(toRadians(a, unit)).sine);
export const cos = (a, unit) =>
  settleAngle(sineCosine(toRadians(a, unit)).cosine);
export const tan = (a, unit) => {
  const { sine, cosine } = sineCosine(toRadians(a, unit));
  if (isZero(settleAngle(cosine))) fail("domain");
  return settleAngle(fixedDivide(sine, cosine));
};

// atan of a fixed value, halving the angle twice before the series.
const atanFixed = (x) => {
  const { pi } = getConstants();
  if (absolute(x) > SCALE) {
    const half = (x < 0n ? -pi : pi) / 2n;
    return half - atanFixed(fixedDivide(SCALE, x));
  }
  let z = x;
  for (let step = 0; step < 2; step += 1)
    z = fixedDivide(z, SCALE + integerRoot(SCALE * SCALE + z * z, 2));
  return atanSeries(z) * 4n;
};

export const atan = (a, unit) =>
  settleAngle(fromRadians(atanFixed(toFixed(a)), unit));
export const asin = (a, unit) => {
  const order = compare(absoluteOf(a), ONE);
  if (order > 0) fail("domain");
  const { pi } = getConstants();
  if (order === 0)
    return settleAngle(fromRadians(isNegative(a) ? -pi / 2n : pi / 2n, unit));
  const x = toFixed(a);
  const cosine = integerRoot(SCALE * SCALE - x * x, 2);
  return settleAngle(fromRadians(atanFixed(fixedDivide(x, cosine)), unit));
};
export const acos = (a, unit) => {
  const right = UNITS[unit]
    ? fromInteger(UNITS[unit] / 2n)
    : settleAngle(getConstants().pi / 2n);
  return subtract(right, asin(a, unit));
};

// ---- Hyperbolic functions, which ignore the angle unit ----

const half = { n: 1n, d: 2n };
export const sinh = (a) => multiply(subtract(exp(a), exp(negate(a))), half);
export const cosh = (a) => multiply(add(exp(a), exp(negate(a))), half);
export const tanh = (a) => {
  if (compare(absoluteOf(a), fromInteger(100)) > 0)
    return isNegative(a) ? negate(ONE) : ONE;
  const square = exp(multiply(a, fromInteger(2)));
  return divide(subtract(square, ONE), add(square, ONE));
};
export const asinh = (a) => {
  const magnitude = absoluteOf(a);
  const value = ln(add(magnitude, squareRoot(add(multiply(a, a), ONE))));
  return isNegative(a) ? negate(value) : value;
};
export const acosh = (a) => {
  if (compare(a, ONE) < 0) fail("domain");
  return ln(add(a, squareRoot(subtract(multiply(a, a), ONE))));
};
export const atanh = (a) => {
  if (compare(absoluteOf(a), ONE) >= 0) fail("domain");
  return multiply(ln(divide(add(ONE, a), subtract(ONE, a))), half);
};

// ---- Factorial: exact for whole numbers, the gamma function otherwise ----

let bernoulliCache = null;
// B2, B4, ... B80 as fractions, by the Akiyama-Tanigawa algorithm.
const bernoulli = () => {
  if (bernoulliCache) return bernoulliCache;
  // Exact fractions throughout: the recurrence cancels heavily.
  const numbers = [];
  const row = [];
  for (let m = 0; m <= 80; m += 1) {
    row[m] = { n: 1n, d: BigInt(m + 1) };
    for (let j = m; j >= 1; j -= 1) {
      const { n, d } = row[j - 1];
      const next = row[j];
      row[j - 1] = reduce(BigInt(j) * (n * next.d - next.n * d), d * next.d);
    }
    if (m >= 2 && m % 2 === 0) numbers.push(row[0]);
  }
  bernoulliCache = numbers;
  return numbers;
};

// ln gamma(z) for z >= 60 by Stirling's series, as a fixed value.
const lnGammaFixed = (z) => {
  const { pi } = getConstants();
  const zFixed = toFixed(z);
  let sum =
    fixedMultiply(zFixed - SCALE / 2n, lnFixed(z)) -
    zFixed +
    lnFixed(fromFixed(pi * 2n)) / 2n;
  const inverseSquare = toFixed(divide(ONE, multiply(z, z)));
  let inversePower = toFixed(divide(ONE, z));
  bernoulli().forEach((number, index) => {
    const k = BigInt(index + 1);
    sum += roundDivide(number.n * inversePower, number.d * 2n * k * (2n * k - 1n));
    inversePower = fixedMultiply(inversePower, inverseSquare);
  });
  return sum;
};

export const factorial = (a) => {
  if (isInteger(a)) {
    if (isNegative(a)) fail("domain");
    const n = Number(a.n);
    if (n * Math.log(n) - n > MAX_EXPONENT) fail("domain");
    let product = 1n;
    for (let factor = 2n; factor <= a.n; factor += 1n) product *= factor;
    return { n: product, d: 1n };
  }
  // x! = gamma(x + 1) = gamma(x + 1 + shift) / (x + 1)(x + 2)...
  let z = add(a, ONE);
  let product = ONE;
  while (compare(z, fromInteger(60)) < 0) {
    product = multiply(product, z);
    z = add(z, ONE);
  }
  const lnGamma = lnGammaFixed(z);
  if (lnGamma > BigInt(MAX_EXPONENT) * SCALE) fail("domain");
  return divide(exp(fromFixed(lnGamma)), product);
};

// ---- Degrees, minutes and seconds ----

const sixty = fromInteger(60);
const hundred = fromInteger(100);
// 1.5 degrees is 1.30: one degree, 30 minutes.
export const toDms = (a) => {
  const degrees = truncate(a);
  const minutesTotal = multiply(subtract(a, degrees), sixty);
  const minutes = truncate(minutesTotal);
  const seconds = multiply(subtract(minutesTotal, minutes), sixty);
  return add(
    add(degrees, divide(minutes, hundred)),
    divide(seconds, fromInteger(10000)),
  );
};
export const fromDms = (a) => {
  const degrees = truncate(a);
  const minutesTotal = multiply(subtract(a, degrees), hundred);
  const minutes = truncate(minutesTotal);
  const seconds = multiply(subtract(minutesTotal, minutes), hundred);
  return add(
    add(degrees, divide(minutes, sixty)),
    divide(seconds, fromInteger(3600)),
  );
};

export const pi = () => fromFixed(getConstants().pi);

// ---- Display ----

// The first `count` significant digits of |a| (truncated, trailing zeros
// dropped) and its exponent: the number of digits before the point.
const leadingDigits = (a, count) => {
  const n = absolute(a.n);
  const estimate = lengthOf(n) - lengthOf(a.d);
  const shift = count + 1 - estimate;
  const scaled =
    shift >= 0 ? (n * 10n ** BigInt(shift)) / a.d : n / (a.d * 10n ** BigInt(-shift));
  const text = scaled.toString();
  return {
    digits: text.slice(0, count).replace(/0+$/, ""),
    exponent: text.length - shift,
  };
};

const groupThousands = (text) => text.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// calc.exe's decimal display: 32 significant digits, rounded half away
// from zero, with the point always shown ("5."), switching to scientific
// notation ("1.e+32") when the number would run past 32 digits before the
// point or 34 after it.
export const formatDecimal = (a, { scientific = false, grouping = false } = {}) => {
  if (isZero(a)) return scientific ? "0.e+0" : "0.";
  let { digits, exponent } = leadingDigits(a, PRECISION + 2);
  // The decision uses the digits before rounding, unless rounding carries
  // into a new digit (9.99... to 10), when calc.exe decides again.
  const tooLong = (length) =>
    exponent > PRECISION || Math.min(length, PRECISION) - exponent > PRECISION + 2;
  let useScientific = scientific || tooLong(digits.length);
  if (digits.length > PRECISION) {
    const rounded = BigInt(digits.slice(0, PRECISION)) + (digits[PRECISION] >= "5" ? 1n : 0n);
    digits = rounded.toString();
    if (digits.length > PRECISION) {
      exponent += 1;
      digits = "1";
      useScientific = scientific || tooLong(1);
    }
    digits = digits.replace(/0+$/, "");
  }
  const sign = isNegative(a) ? "-" : "";
  if (useScientific) {
    const power = exponent - 1;
    return `${sign}${digits[0]}.${digits.slice(1)}e${power < 0 ? "-" : "+"}${Math.abs(power)}`;
  }
  if (exponent <= 0)
    return `${sign}0.${"0".repeat(-exponent)}${digits}`;
  const whole = digits.slice(0, exponent).padEnd(exponent, "0");
  return `${sign}${grouping ? groupThousands(whole) : whole}.${digits.slice(exponent)}`;
};

const GROUP_SIZES = { 16: 4, 8: 3, 2: 4 };
// Hexadecimal, octal and binary show whole numbers without a point,
// grouped with spaces.
export const formatRadix = (value, radix, grouping = false) => {
  const text = value.toString(radix).toUpperCase();
  if (!grouping) return text;
  const size = GROUP_SIZES[radix];
  return text.replace(new RegExp(`\\B(?=(.{${size}})+$)`, "g"), " ");
};

// The whole value within a word: negative numbers wrap to two's
// complement, as in Hex -1 is FFFFFFFFFFFFFFFF.
export const toWord = (a, bits) => BigInt.asUintN(bits, truncate(a).n);
