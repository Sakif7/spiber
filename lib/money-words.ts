/**
 * Amounts in words, for the "Amount in Words" line every invoice carries.
 *
 * Bangladeshi grouping: crore (10,000,000) and lakh (100,000) rather than
 * million/billion, so 88,400 reads "Eighty Eight Thousand Four Hundred Taka
 * Only" and 1,25,00,000 reads "One Crore Twenty Five Lakh Taka Only".
 */

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

/** 0–99. */
function twoDigits(n: number): string {
  if (n < 20) return ONES[n]!;
  const tens = TENS[Math.floor(n / 10)]!;
  const ones = ONES[n % 10]!;
  return ones ? `${tens} ${ones}` : tens;
}

/** 0–999. */
function threeDigits(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
  if (rest) parts.push(twoDigits(rest));
  return parts.join(" ");
}

/** A whole number of taka, in words, without the "Taka" suffix. */
export function numberToWords(value: number): string {
  const n = Math.floor(Math.abs(value));
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  const parts: string[] = [];
  if (crore) parts.push(`${numberToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) parts.push(threeDigits(rest));
  return parts.join(" ");
}

/**
 * An amount in poisha as the invoice's words line.
 * Poisha only appear when there are some, which is how the paper invoices read.
 */
export function amountInWords(minor: number): string {
  if (minor < 0) throw new Error("amountInWords: amount cannot be negative");
  const taka = Math.floor(minor / 100);
  const poisha = minor % 100;
  const takaWords = `${numberToWords(taka)} Taka`;
  if (poisha === 0) return `${takaWords} Only`;
  return `${takaWords} and ${twoDigits(poisha)} Poisha Only`;
}
