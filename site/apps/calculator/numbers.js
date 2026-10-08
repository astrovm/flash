// Calculator numbers: exact rationals, n / d × 10^e with BigInt n and d,
// like calc.exe's ratpak keeps p / q. Sums, products and quotients stay
// exact; numbers too long to keep round to KEEP digits. Functions such as
// sin and ln work in fixed point with WORK digits, well past the 32 that
// Calculator shows.

const LIMIT_BITS = 700;
const KEEP = 100;
const WORK = 100;
// 10^MAX_EXPONENT is the largest magnitude kept; past it, like calc.exe
// for 10^100000, a function reports invalid input.
export const MAX_EXPONENT = 99999;

const TEN = 10n;
const S = TEN ** BigInt(WORK);
const PI_DIGITS =
  "31415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679821480865132823066470938446";

export const ERRORS = {
  divide: "Cannot divide by zero.",
  domain: "Invalid input for function.",
  undefined: "Result of function is undefined.",
};

export class CalculatorError extends Error {
  constructor(code) {
    super(ERRORS[code]);
    this.code = code;
  }
}
const fail = (code) => {
  throw new CalculatorError(code);
};

const absBig = (value) => (value < 0n ? -value : value);
const digitCount = (value) => absBig(value).toString().length;
const bitLength = (value) => absBig(value).toString(2).length;
const pow10 = (exponent) => TEN ** BigInt(exponent);
const gcd = (a, b) => {
  a = absBig(a);
  while (b) [a, b] = [b, a % b];
  return a;
};
// Rounds a / b half away from zero, b positive.
const roundDivide = (a, b) => {
  const quotient = (absBig(a) * 2n + b) / (2n * b);
  return a < 0n ? -quotient : quotient;
};

export const ZERO = Object.freeze({ n: 0n, d: 1n, e: 0 });

export const number = (n, d = 1n, e = 0) => {
  if (n === 0n) return ZERO;
  if (d < 0n) [n, d] = [-n, -d];
  const divisor = gcd(n, d);
  n /= divisor;
  d /= divisor;
  while (n % TEN === 0n) [n, e] = [n / TEN, e + 1];
  while (d % TEN === 0n) [d, e] = [d / TEN, e - 1];
  if (bitLength(n) > LIMIT_BITS || bitLength(d) > LIMIT_BITS) {
    const shift = KEEP - digitCount(n) + digitCount(d);
    n =
      shift >= 0
        ? roundDivide(n * pow10(shift), d)
        : roundDivide(n, d * pow10(-shift));
    return number(n, 1n, e - shift);
  }
  const magnitude = digitCount(n) - digitCount(d) + e;
  if (magnitude > MAX_EXPONENT) fail("domain");
  if (magnitude < -MAX_EXPONENT) return ZERO;
  return { n, d, e };
};

export const integer = (value) => number(BigInt(value));
export const isZero = (x) => x.n === 0n;
export const sign = (x) => (x.n < 0n ? -1 : x.n > 0n ? 1 : 0);
export const negate = (x) => number(-x.n, x.d, x.e);
export const absolute = (x) => number(absBig(x.n), x.d, x.e);

// Brings two numbers to one exponent, so their n / d share a scale.
const align = (x, y) => {
  const e = Math.min(x.e, y.e);
  return [x.n * pow10(x.e - e), y.n * pow10(y.e - e), e];
};

export const add = (x, y) => {
  if (isZero(x)) return y;
  if (isZero(y)) return x;
  // Far smaller addends vanish below the kept digits.
  const gap = magnitudeOf(x) - magnitudeOf(y);
  if (gap > KEEP + 2) return x;
  if (gap < -KEEP - 2) return y;
  const [a, b, e] = align(x, y);
  return number(a * y.d + b * x.d, x.d * y.d, e);
};
export const subtract = (x, y) => add(x, negate(y));
export const multiply = (x, y) => number(x.n * y.n, x.d * y.d, x.e + y.e);
export const divide = (x, y) => {
  if (isZero(y)) fail(isZero(x) ? "undefined" : "divide");
  return number(x.n * y.d, x.d * y.n, x.e - y.e);
};
export const compare = (x, y) => sign(subtract(x, y));

// floor(log10 |x|), exactly: |n| / d against 10^(estimate - e).
export const magnitudeOf = (x) => {
  const shift = digitCount(x.d) - digitCount(x.n);
  const n = absBig(x.n);
  const below = shift >= 0 ? n * pow10(shift) < x.d : n < x.d * pow10(-shift);
  return x.e - shift - (below ? 1 : 0);
};

// Toward zero, as BigInt.
export const toBigInt = (x) =>
  x.e >= 0 ? (x.n * pow10(x.e)) / x.d : x.n / (x.d * pow10(-x.e));
export const truncate = (x) => number(toBigInt(x));
export const fraction = (x) => subtract(x, truncate(x));
export const isInteger = (x) => isZero(fraction(x));

// The first `count` significant digits, truncated: 0.digits × 10^point.
export const significantDigits = (x, count) => {
  const point = magnitudeOf(x) + 1;
  const shift = count - point + x.e;
  const n = absBig(x.n);
  const digits =
    shift >= 0 ? (n * pow10(shift)) / x.d : n / (x.d * pow10(-shift));
  return { digits: digits.toString(), point };
};

// Number of decimal places, at most `limit`.
export const decimalPlaces = (x, limit) => {
  for (let places = 0; places < limit; places += 1)
    if (isInteger(multiply(x, number(1n, 1n, places)))) return places;
  return limit;
};

// ---- Fixed point, scaled by 10^WORK ----
const toFixed = (x) =>
  x.e >= 0
    ? roundDivide(x.n * pow10(x.e) * S, x.d)
    : roundDivide(x.n * S, x.d * pow10(-x.e));
const fromFixed = (value) => number(value, S);
const fixedMultiply = (a, b) => (a * b) / S;
const fixedDivide = (a, b) => (a * S) / b;
const ONE = S;
const PI = BigInt(PI_DIGITS.slice(0, WORK + 1));
const HALF_PI = PI / 2n;

// Integer square root, rounded down.
const integerRoot = (value, degree) => {
  if (value < 2n) return value;
  let root = 1n << BigInt(Math.ceil(bitLength(value) / degree));
  for (;;) {
    const next =
      ((BigInt(degree) - 1n) * root + value / root ** BigInt(degree - 1)) /
      BigInt(degree);
    if (next >= root) return root;
    root = next;
  }
};
const fixedSqrt = (a) => integerRoot(a * S, 2);

// atanh series: ln y = 2 atanh((y - 1) / (y + 1)).
const atanhSeries = (z) => {
  const square = fixedMultiply(z, z);
  let term = z;
  let sum = z;
  for (let k = 3n; term; k += 2n) {
    term = fixedMultiply(term, square);
    sum += term / k;
  }
  return sum;
};
const LN2 = 2n * atanhSeries(ONE / 3n);
const LN10 = 3n * LN2 + 2n * atanhSeries(ONE / 9n);

// Natural logarithm of a positive number, in fixed point.
const fixedLn = (x) => {
  const shift = bitLength(x.n) - bitLength(x.d);
  const n = shift >= 0 ? x.n : x.n << BigInt(-shift);
  const d = shift >= 0 ? x.d << BigInt(shift) : x.d;
  const y = (n * S) / d;
  return (
    2n * atanhSeries(fixedDivide(y - ONE, y + ONE)) +
    BigInt(shift) * LN2 +
    BigInt(x.e) * LN10
  );
};

// e^(a / 10^WORK) as a number.
const LIMIT_LN = BigInt(MAX_EXPONENT + 2) * LN10;
const fixedExp = (a) => {
  if (a > LIMIT_LN) fail("domain");
  if (a < -LIMIT_LN) return ZERO;
  const k = roundDivide(a, LN2);
  const r = a - k * LN2;
  let term = ONE;
  let sum = ONE;
  for (let index = 1n; term; index += 1n) {
    term = fixedMultiply(term, r) / index;
    sum += term;
  }
  return k >= 0n ? number(sum << k, S) : number(sum, S << -k);
};

// sin and cos of a / 10^WORK radians.
const fixedSinCos = (a) => {
  const quarter = roundDivide(a, HALF_PI);
  const r = a - quarter * HALF_PI;
  const square = fixedMultiply(r, r);
  let sin = r;
  let cos = ONE;
  let term = r;
  for (let k = 2n; term; k += 2n) {
    term = -fixedMultiply(term, square) / (k * (k + 1n));
    sin += term;
  }
  term = ONE;
  for (let k = 1n; term; k += 2n) {
    term = -fixedMultiply(term, square) / (k * (k + 1n));
    cos += term;
  }
  // The last few units are rounding noise, as in sin(pi). The reduced
  // angle's cosine is never that small.
  if (absBig(sin) < 1000n) sin = 0n;
  const turn = Number(((quarter % 4n) + 4n) % 4n);
  return [
    [sin, cos],
    [cos, -sin],
    [-sin, -cos],
    [-cos, sin],
  ][turn];
};

const fixedAtan = (a) => {
  if (absBig(a) > ONE) {
    const outer = a > 0n ? HALF_PI : -HALF_PI;
    return outer - fixedAtan(fixedDivide(ONE, a));
  }
  // atan x = 2 atan(x / (1 + sqrt(1 + x²))), twice, then the series.
  let x = a;
  for (let halving = 0; halving < 2; halving += 1)
    x = fixedDivide(x, ONE + fixedSqrt(ONE + fixedMultiply(x, x)));
  const square = fixedMultiply(x, x);
  let term = x;
  let sum = x;
  for (let k = 3n; term; k += 2n) {
    term = -fixedMultiply(term, square);
    sum += term / k;
  }
  return sum * 4n;
};

// ---- Functions ----
export const pi = () => fromFixed(PI);
export const twoPi = () => fromFixed(PI * 2n);

export const ln = (x) => {
  if (sign(x) <= 0) fail("domain");
  return fromFixed(fixedLn(x));
};
export const log10 = (x) => {
  if (sign(x) <= 0) fail("domain");
  // Powers of ten have exact logarithms.
  if (x.n === 1n && x.d === 1n) return integer(x.e);
  return fromFixed(fixedDivide(fixedLn(x), LN10));
};
export const exp = (x) => fixedExp(toFixed(x));

const rootExactly = (value, degree) => {
  const root = integerRoot(value, degree);
  return root ** BigInt(degree) === value ? root : null;
};

// x^(1 / degree) for a whole degree; exact for exact roots.
const wholeRoot = (x, degree) => {
  if (x.e % degree === 0) {
    const n = rootExactly(x.n, degree);
    const d = rootExactly(x.d, degree);
    if (n !== null && d !== null) return number(n, d, x.e / degree);
  }
  return null;
};

export const power = (x, y) => {
  if (isInteger(y)) {
    const exponent = toBigInt(y);
    if (isZero(x)) {
      if (exponent < 0n) fail("domain");
      return exponent === 0n ? integer(1) : ZERO;
    }
    // Results past 10^MAX_EXPONENT fail before they are worked out.
    const { digits, point } = significantDigits(x, 17);
    const size = (point + Math.log10(Number(`0.${digits}`))) * Number(exponent);
    if (size > MAX_EXPONENT + 1) fail("domain");
    if (size < -MAX_EXPONENT) return ZERO;
    let result = integer(1);
    let base = exponent < 0n ? divide(integer(1), x) : x;
    for (let bits = absBig(exponent); bits; bits >>= 1n) {
      if (bits & 1n) result = multiply(result, base);
      if (bits > 1n) base = multiply(base, base);
    }
    return result;
  }
  if (sign(x) < 0) fail("domain");
  if (isZero(x)) return ZERO;
  // Exact roots, such as 8^(1/3) or 0.04^(1/2).
  const reciprocal = divide(integer(1), y);
  if (isInteger(reciprocal) && absBig(toBigInt(reciprocal)) <= 64n) {
    const degree = Number(toBigInt(reciprocal));
    const root = wholeRoot(absolute(x), Math.abs(degree));
    if (root) return degree < 0 ? divide(integer(1), root) : root;
  }
  return fixedExp(fixedMultiply(fixedLn(x), toFixed(y)));
};

export const root = (x, y) => power(x, divide(integer(1), y));

// Turns an angle into radians in fixed point, or reports exact quarter
// turns: 0 to 3 for 0, 90, 180 and 270 degrees.
const UNITS = { degrees: 360n, radians: 0n, grads: 400n };
const angleOf = (x, unit) => {
  const full = UNITS[unit];
  if (!full) return { radians: toFixed(x) };
  const turns = number(full);
  let reduced = subtract(x, multiply(truncate(divide(x, turns)), turns));
  if (sign(reduced) < 0) reduced = add(reduced, turns);
  const twelfths = divide(multiply(reduced, integer(12)), turns);
  return {
    radians: fixedDivide(
      fixedMultiply(toFixed(reduced), PI * 2n),
      toFixed(turns),
    ),
    twelfth: isInteger(twelfths) ? Number(toBigInt(twelfths)) : null,
  };
};

// Exact sines at whole twelfths of a turn: 0, 1/2 and 1.
const EXACT_SINES = [0, 1, null, 2, null, 1, 0, -1, null, -2, null, -1];
const exactSine = (twelfth) => {
  const value = EXACT_SINES[twelfth];
  return value === null ? null : number(BigInt(value), 2n);
};

export const sin = (x, unit) => {
  const { radians, twelfth = null } = angleOf(x, unit);
  if (twelfth !== null && exactSine(twelfth)) return exactSine(twelfth);
  return fromFixed(fixedSinCos(radians)[0]);
};
export const cos = (x, unit) => {
  const { radians, twelfth = null } = angleOf(x, unit);
  if (twelfth !== null && exactSine((twelfth + 3) % 12))
    return exactSine((twelfth + 3) % 12);
  return fromFixed(fixedSinCos(radians)[1]);
};
export const tan = (x, unit) => {
  const { radians, twelfth = null } = angleOf(x, unit);
  if (twelfth !== null && twelfth % 3 === 0) {
    if (twelfth % 6) fail("domain");
    return ZERO;
  }
  const [s, c] = fixedSinCos(radians);
  if (absBig(c) < 10n) fail("domain");
  return number(s, c);
};

const fromRadians = (a, unit) => {
  const full = UNITS[unit];
  return full ? number(a * full, PI * 2n) : fromFixed(a);
};
const unitInterval = (x) => {
  if (compare(absolute(x), integer(1)) > 0) fail("domain");
  return toFixed(x);
};
export const asin = (x, unit) => {
  const a = unitInterval(x);
  if (absBig(a) === ONE) return fromRadians(a > 0n ? HALF_PI : -HALF_PI, unit);
  return fromRadians(
    fixedAtan(fixedDivide(a, fixedSqrt(ONE - fixedMultiply(a, a)))),
    unit,
  );
};
export const acos = (x, unit) => {
  const a = unitInterval(x);
  if (absBig(a) === ONE) return fromRadians(a > 0n ? 0n : PI, unit);
  return fromRadians(
    HALF_PI - fixedAtan(fixedDivide(a, fixedSqrt(ONE - fixedMultiply(a, a)))),
    unit,
  );
};
export const atan = (x, unit) => fromRadians(fixedAtan(toFixed(x)), unit);

export const sinh = (x) => {
  if (sign(x) < 0) return negate(sinh(negate(x)));
  return divide(subtract(exp(x), exp(negate(x))), integer(2));
};
export const cosh = (x) => divide(add(exp(x), exp(negate(x))), integer(2));
export const tanh = (x) => {
  if (compare(absolute(x), integer(200)) > 0) return integer(sign(x));
  const e2 = exp(multiply(x, integer(2)));
  return divide(subtract(e2, integer(1)), add(e2, integer(1)));
};
export const asinh = (x) => {
  if (sign(x) < 0) return negate(asinh(negate(x)));
  return ln(add(x, squareRoot(add(multiply(x, x), integer(1)))));
};
export const acosh = (x) => {
  if (compare(x, integer(1)) < 0) fail("domain");
  return ln(add(x, squareRoot(subtract(multiply(x, x), integer(1)))));
};
export const atanh = (x) => {
  if (compare(absolute(x), integer(1)) >= 0) fail("domain");
  return divide(
    ln(divide(add(integer(1), x), subtract(integer(1), x))),
    integer(2),
  );
};

export const squareRoot = (x) => root(x, integer(2));

// Bernoulli numbers B2, B4, ... for Stirling's series.
let bernoulli = null;
const bernoulliNumbers = () => {
  if (bernoulli) return bernoulli;
  const values = [];
  const row = [];
  for (let m = 0; m <= 60; m += 1) {
    row[m] = number(1n, BigInt(m + 1));
    for (let j = m; j > 0; j -= 1)
      row[j - 1] = multiply(integer(j), subtract(row[j - 1], row[j]));
    if (m >= 2 && m % 2 === 0) values.push(row[0]);
  }
  bernoulli = values;
  return values;
};

const factorialProduct = (low, high) => {
  if (high - low < 16n) {
    let product = 1n;
    for (let value = low; value <= high; value += 1n) product *= value;
    return product;
  }
  const middle = (low + high) / 2n;
  return factorialProduct(low, middle) * factorialProduct(middle + 1n, high);
};

// n!, or Γ(n + 1) for numbers that are not whole.
export const factorial = (x) => {
  if (isInteger(x)) {
    const n = toBigInt(x);
    if (n < 0n) fail("domain");
    // 25206! is the first factorial past 10^100000.
    if (n > 25205n) fail("domain");
    return integer(factorialProduct(1n, n));
  }
  // Γ(z) = Γ(z + shift) / (z (z + 1) ... (z + shift - 1)), with Stirling's
  // series for the shifted Γ.
  let z = add(x, integer(1));
  let shift = 0;
  let product = integer(1);
  while (compare(z, integer(50)) < 0) {
    product = multiply(product, z);
    z = add(z, integer(1));
    shift += 1;
  }
  const w = toFixed(z);
  let series =
    fixedMultiply(w - ONE / 2n, fixedLn(z)) - w + fixedLn(twoPi()) / 2n;
  let power = w;
  const square = fixedMultiply(w, w);
  bernoulliNumbers().forEach((value, index) => {
    const k = BigInt(index + 1);
    series += fixedDivide(
      toFixed(divide(value, integer(2n * k * (2n * k - 1n)))),
      power,
    );
    power = fixedMultiply(power, square);
  });
  return divide(fixedExp(series), shift ? product : integer(1));
};
