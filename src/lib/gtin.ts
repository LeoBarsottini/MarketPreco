/** Validates EAN-8, UPC-A (12), EAN-13 and GTIN-14 using the GS1 check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => {
    sum += d * (i % 2 === 0 ? 3 : 1);
  });
  return (10 - (sum % 10)) % 10 === check;
}

export function cleanBarcode(raw: string): string {
  return raw.replace(/\D/g, "");
}
