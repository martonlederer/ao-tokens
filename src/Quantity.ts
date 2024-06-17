import { type TokenInstance } from "./Token";

export default class Quantity {
  // base quantity
  #qty: bigint;

  // denomination
  #D: bigint;

  /**
   * Parse or load 
   * @param base Quantity in integer/non-denominated format or string
   * @param denomination Denomination that belongs to the token
   */
  constructor(base?: bigint | string | number | Quantity, denomination = 0n) {
    this.#D = denomination;
    this.#qty = 0n;

    // init
    switch (typeof base) {
      case "bigint":
        this.#qty = base;
        break;
      case "string":
        try {
          this.#qty = BigInt(base);
          break;
        } catch {
          throw new Error(
            "Could not parse Quantity from string. Make sure to use Quantity.fromString() to load denominated values"
          );
        }
      case "number":
        if (!Number.isInteger(base)) {
          throw new Error("Cannot create Quantity from a non-integer number");
        }
        this.#qty = BigInt(base);
        break;
      case "object":
        if (!Quantity.isQuantity(base)) {
          throw new Error("Could not convert object to quantity");
        }
        
        base = base.clone();
        base._convert(this.#D);
        this.#qty = base.#qty;
        break;
      case "undefined":
        break;
      default:
        throw new Error("Could not create Quantity from " + typeof base);
    }
  }

  /**
   * Raw base quantity
   */
  get raw() {
    return this.#qty;
  }

  /**
   * Integer/whole part
   */
  get integer() {
    return this.#qty / 10n ** this.#D;
  }

  /**
   * Fractional part in integers
   */
  get fractional() {
    return this.#qty - this.integer * 10n ** this.#D;
  }

  /**
   * Denomination
   */
  get denomination() {
    return this.#D;
  }

  /**
   * Check if a value is a valid quantity
   * @param val Value to check
   * @returns Valid or not
   */
  static isQuantity(val: unknown): val is Quantity {
    return typeof val === "object" && val instanceof Quantity;
  }
  
  /**
   * Check if a value is a quantity of a token process
   * (this only works if the token info has been loaded)
   * @param val Value to check
   * @param token Token process instance
   * @returns Valid or not
   */
  static isQuantityOf(val: Quantity, token: TokenInstance) {
    if (!Quantity.isQuantity(val)) return false;
    return token.info.Denomination === val.#D;
  }

  /**
   * Load a quantity from a string while keeping precision
   * until the denomination is reached
   * @param value String to load as a quantity
   */
  fromString(value: string) {
    if (!value) {
      this.#qty = 0n;
      return this;
    }

    // replace formatters
    value = value.replace(/,/g, "");

    // empty value
    if (value === "") {
      this.#qty = 0n;
      return this;
    }

    // multiplier according to the denomination
    const dMul = 10n ** this.#D;

    // calculate result
    let result = BigInt(value.split(".")[0]) * dMul;
    const plainFractions = value.split(".")[1];

    if (plainFractions && plainFractions !== "") {
      // select part that is max. as long as the denomination
      // the other part is discarded
      const relevantPart = plainFractions.slice(0, Number(this.#D));
      let fractionalPart = BigInt(relevantPart);

      // fill to match denomination
      if (BigInt(relevantPart.length) < this.#D) {
        fractionalPart = fractionalPart * 10n ** (this.#D - BigInt(relevantPart.length));
      }

      result += fractionalPart;
    }

    // set result
    this.#qty = result;

    return this;
  }

  /**
   * Load a quantity from a number while keeping precision
   * until the denomination is reached
   * @param value Number to load as a quantity
   */
  fromNumber(value: number) {
    return this.fromString(value.toString());
  }

  /**
   * Format a quantity as a floating point number string,
   * while keeping precision (using the provided 
   * denomination)
   * @param options Optinal formatting for the number
   * @returns Formatted string
   */
  toLocaleString(locales?: Intl.LocalesArgument, options: BigIntToLocaleStringOptions = {}) {
    if (!this.#qty) return "0";
    if (!options.maximumFractionDigits) {
      // @ts-expect-error
      options.maximumFractionDigits = Number(this.#D) > 20 ? 20 : Number(this.#D);
    }

    // multiplier according to the denomination
    const dMul = 10n ** this.#D;

    // fractional and integer parts
    const integerPart = this.#qty / dMul;

    // return value
    let formatted = integerPart.toLocaleString(
      locales,
      { ...options, maximumFractionDigits: 0, minimumFractionDigits: 0 }
    );

    // add fractions
    if (options.maximumFractionDigits !== 0) {
      // starting index of the fractional part
      const fractionalPartStart = integerPart !== 0n ? integerPart.toString().length : 0;

      // calculate fractional part
      let fractions = this.#qty
        .toString()
        .slice(fractionalPartStart)
        .padStart(Number(this.#D), "0")
        .slice(0, options.maximumFractionDigits);

      // add more fractions if required
      if ((options.minimumFractionDigits || 0) > fractions.length) {
        fractions += "0".repeat((options.minimumFractionDigits || 0) - fractions.length);
      }

      if (fractions !== "" && BigInt(fractions) > 0n) {
        formatted += "." + fractions.replace(/0*$/, "");
      }
    }

    return formatted;
  }

  /**
   * Format a quantity as a floating point number string,
   * while keeping precision (using the provided 
   * denomination)
   */
  toString() {
    return this.toLocaleString(
      undefined,
      { useGrouping: false }
    );
  }

  /**
   * Format a quantity as a JavaScript floating point number.
   * This while cause precision loss
   */
  toNumber() {
    // minimize precision loss by first creating a string
    const str = this.toString();

    return parseFloat(str);
  }

  /**
   * Clone Quantity instance
   */
  clone() {
    return new Quantity(
      this.#qty,
      this.#D
    );
  }

  /**
   * Shortcut/set to to one (in-place)
   */
  _one() {
    this.#qty = 10n ** this.#D;
    return this;
  }

  /**
   * Shortcut/set to one
   */
  static __one(denomination: bigint = 0n) {
    return new Quantity(
      10n ** denomination,
      denomination
    );
  }

  /**
   * Convert the quantity (in-place) to use a different
   * denomination
   * @param newDenomination Denomination to convert to
   */
  _convert(newDenomination: bigint) {
    const newInst = Quantity.__convert(this, newDenomination);

    this.#D = newDenomination;
    this.#qty = newInst.#qty;

    return this;
  }

  /**
   * Create a new instance with the same quantity, but a
   * different denomination. This will cause precision
   * loss if the new denomination is smaller than the
   * original
   * @param quantity Quantity to convert
   * @param newDenomination Denomination to convert to
   * @returns New instance
   */
  static __convert(instance: Quantity, newDenomination: bigint): Quantity {
    const denominationDiff = newDenomination - instance.#D;

    // downscale
    let newQty = 0n;

    // upscale
    if (newDenomination >= instance.#D) {
      newQty = instance.#qty * 10n ** denominationDiff;
    } else {
      newQty = instance.#qty / 10n ** -denominationDiff;
    }

    return new Quantity(newQty, newDenomination);
  }

  /**
   * Operators
   */

  /**
   * Bring two quantities to the same denomination
   * (will always bring to the larger one)
   * @param ... Quantities
   * @returns The quantitieson the same denomination
   */
  static sameDenomination(...quantities: Quantity[]) {
    if (quantities.length < 1) return quantities;

    // find the largest denomination
    const largestDenomination = quantities.reduce(
      (prev, curr) => prev.#D > curr.#D ? prev : curr
    ).#D;

    // adjust quantities
    for (let i = 0; i < quantities.length; i++) {
      if (quantities[i].#D === largestDenomination) continue;

      quantities[i] = Quantity.__convert(
        quantities[i],
        largestDenomination
      );
    }

    return quantities;
  }

  /**
   * Check if quantities are equal
   * @param x First quantity
   * @param y Second quantity
   * @returns x == y
   */
  static eq(x: Quantity, y: Quantity) {
    // ensure that the two qtys have the same denomination
    [x, y] = this.sameDenomination(x, y);

    return x.#qty === y.#qty;
  }

  /**
   * Check if x is less than y
   * @param x First quantity
   * @param y Second quantity
   * @returns x < y
   */
  static lt(x: Quantity, y: Quantity) {
    [x, y] = this.sameDenomination(x, y);

    return x.#qty < y.#qty;
  }

  /**
   * Check if x is less or equal than y
   * @param x First quantity
   * @param y Second quantity
   * @returns x <= y
   */
  static le(x: Quantity, y: Quantity) {
    [x, y] = this.sameDenomination(x, y);

    return x.#qty <= y.#qty;
  }

  /**
   * Add together two quantities
   * @param x First quantity
   * @param y Second quantity
   * @returns Result of the addition (with the larger denomination)
   */
  static __add(x: Quantity, y: Quantity) {
    // ensure that the two qtys have the same denomination
    [x, y] = this.sameDenomination(x, y);

    return new Quantity(
      x.#qty + y.#qty,
      x.#D
    );
  }

  /**
   * Add together two quantities (in-place). This might cause
   * precision loss if y has a larger denomination
   * @param y Second quantity
   */
  _add(y: Quantity) {
    const res = Quantity.__convert(
      Quantity.__add(this, y),
      this.#D
    );
    this.#qty = res.#qty;
  }

  /**
   * Subtract one quantity from another
   * @param x Quantity to subtract from
   * @param y Quantity to subtract
   * @returns Result of the addition (with the larger denomination)
   */
  static __sub(x: Quantity, y: Quantity) {
    // ensure that the two qtys have the same denomination
    [x, y] = this.sameDenomination(x, y);

    return new Quantity(
      x.#qty - y.#qty,
      x.#D
    );
  }

  /**
   * Subtract one quantity from another (in-place). This might cause
   * precision loss if y has a larger denomination
   * @param y Quantity to subtract
   */
  _sub(y: Quantity) {
    const res = Quantity.__convert(
      Quantity.__sub(this, y),
      this.#D
    );
    this.#qty = res.#qty;
  }

  /**
   * Multiply one quantity by another
   * @param x First quantity
   * @param y Second quantity
   * @returns Result of the multiplication (with the larger denomination)
   */
  static __mul(x: Quantity, y: Quantity) {
    // ensure that the two qtys have the same denomination
    [x, y] = this.sameDenomination(x, y);

    return new Quantity(
      x.#qty * y.#qty / 10n ** x.#D,
      x.#D
    );
  }

  /**
   * Multiply one quantity by another (in-place). This might cause
   * precision loss if y has a larger denomination
   * @param y Quantity to multiply by
   */
  _mul(y: Quantity) {
    const res = Quantity.__convert(
      Quantity.__mul(this, y),
      this.#D
    );
    this.#qty = res.#qty;
  }

  /**
   * Divide one quantity by another (can cause precision loss)
   * @param x Quantity to divide
   * @param y Quantity to divide with
   * @returns Result of the addition (with the larger denomination)
   */
  static __div(x: Quantity, y: Quantity) {
    // ensure that the two qtys have the same denomination
    [x, y] = this.sameDenomination(x, y);

    return new Quantity(
      x.#qty * 10n ** x.#D / y.#qty,
      x.#D
    );
  }

  /**
   * Divide one quantity by another (in-place). This might cause
   * precision loss if y has a larger denomination
   * @param y Quantity to divide with
   */
  _div(y: Quantity) {
    const res = Quantity.__convert(
      Quantity.__div(this, y),
      this.#D
    );
    this.#qty = res.#qty;
  }

  /**
   * Raise one quantity to the power of another. This can cause precision loss
   * @param x Quantity to raise
   * @param y Exponent
   * @returns Result of the power operation
   */
  static __pow(x: Quantity, y: Quantity | bigint) {
    if (typeof y !== "bigint" && !Quantity.isQuantity(y)) {
      throw new Error("Invalid exponent");
    }

    // power of 0
    if ((typeof y === "bigint" && y === 0n) || Quantity.isQuantity(y) && Quantity.eq(y, new Quantity(0n, y.#D))) {
      return Quantity.__one(x.#D);
    }

    // integer power
    if (typeof y === "bigint") {
      const positivePower = new Quantity(
        x.#qty ** (y > 0 ? y : -y),
        x.#D ** y
      )._convert(x.#D);

      // negative exponent
      if (y > 0) return positivePower;

      // calculate negative exponent
      const result = Quantity.__one(x.#D);
      result._div(positivePower);

      return result;
    }

    // ensure same denomination
    [x, y] = Quantity.sameDenomination(x, y);

    let res = x.clone();

    for (let i = 0; i < Math.abs(y) - 1; i++) {
      res._mul(x);
    }

    // negative exponent
    if (y < 0) {
      res = Quantity.__div(
        Quantity.__one(res.#D),
        res
      );
    }

    return res;
  }

  /**
   * Raise one quantity to the power of another (in-place). This can cause
   * precision loss
   * @param y Exponent
   */
  _pow(y: Quantity | bigint) {
    const res = Quantity.__convert(
      Quantity.__pow(this, y),
      this.#D
    );
    this.#qty = res.#qty;
  }

  /**
   * Get the remainder left when x is divided by y
   * @param x Quantity to divide
   * @param y Quantity to divide with
   * @returns The remaineder left after the operation
   */
  static __mod(x: Quantity, y: Quantity) {
    [x, y] = Quantity.sameDenomination(x, y);

    return new Quantity(
      x.#qty % y.#qty,
      x.#D
    );
  }

  /**
   * Get the remainder left when divided by y (in-place)
   * @param y Quantity to divide with
   */
  _mod(y: Quantity) {
    const res = Quantity.__convert(
      Quantity.__mod(this, y),
      this.#D
    );
    this.#qty = res.#qty;
  }

  /**
   * Other Math functions
   */

  /**
   * Get the minimum of a list of quantities
   * @param ... Quantities to choose from
   * @returns Minimum quantity instance of the list
   */
  static min(...quantities: Quantity[]) {
    if (quantities.length === 0) {
      return undefined;
    }
    
    return quantities.reduce(
      (prev, curr) => {
        const [a, b] = this.sameDenomination(prev, curr);

        return this.lt(a, b) ? prev : curr;
      }
    );
  }

  /**
   * Get the maximum of a list of quantities
   * @param ... Quantities to choose from
   * @returns Maximum quantity instance of the list
   */
  static max(...quantities: Quantity[]) {
    if (quantities.length === 0) {
      return undefined;
    }
      
    return quantities.reduce(
      (prev, curr) => {
        const [a, b] = this.sameDenomination(prev, curr);
  
        return this.lt(a, b) ? curr : prev;
      }
    );
  }

  /**
   * Truncate a quantity
   * @param x Quantity to truncate
   * @returns Whole number (truncated)
   */
  static __trunc(x: Quantity) {
    return new Quantity(
      x.#qty - x.#qty % 10n ** x.#D,
      x.#D
    );
  }

  /**
   * Truncate a quantity (in-place)
   */
  _trunc() {
    const res = Quantity.__trunc(this);
    this.#qty = res.#qty;
  }

  /**
   * Rounds down
   * @param x Quantity to round down
   * @returns Rounded down instance
   */
  static __floor(x: Quantity) {
    let res = Quantity.__trunc(x);

    if (x.#qty < 0n) {
      res.#qty -= 10n ** x.#D;
    }

    return res;
  }

  /**
   * Rounds down (in-place)
   */
  _floor() {
    const res = Quantity.__floor(this);
    this.#qty = res.#qty;
  }

  /**
   * Rounds up
   * @param x Quantity to round up
   * @returns Rounded up instance
   */
  static __ceil(x: Quantity) {
    let res = Quantity.__trunc(x);

    if (x.#qty > 0n) {
      res.#qty += 10n ** x.#D;
    }

    return res;
  }

  /**
   * Rounds up (in-place)
   */
  _ceil() {
    const res = Quantity.__ceil(this);
    this.#qty = res.#qty;
  }

  /**
   * Negate a quantity
   * @param x Quantity to negate
   * @returns Negated instance
   */
  static __neg(x: Quantity) {
    return new Quantity(
      -x.#qty,
      x.#D
    );
  }

  /**
   * Negate a quantity (in-place)
   */
  _neg() {
    this.#qty = -this.#qty;
  }

  /**
   * Get the absolute value of a quantity
   * @param x Quantity to get the absolute value of
   * @returns Absolute value
   */
  static __abs(x: Quantity) {
    let res = x.clone();

    if (x.#qty < 0n) {
      res.#qty = -res.#qty;
    }

    return res;
  }

  /**
   * Get the absolute value of a quantity (in-place)
   */
  _abs() {
    if (this.#qty >= 0n) return;
    this.#qty = -this.#qty;
  }
}
