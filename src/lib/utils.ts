import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx and tailwind-merge.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a number as IDR currency (Full version with Rp).
 */
export function formatCurrencyIDR(value: number, includeDecimals: boolean = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: includeDecimals ? 2 : 0,
    maximumFractionDigits: includeDecimals ? 2 : 0,
  }).format(value).replace("IDR", "Rp");
}

/**
 * Formats a string value with thousands separators for input fields.
 */
export function formatThousands(value: string): string {
  if (!value) return "";
  const num = value.replace(/[^0-9]/g, "");
  return num.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Strips non-numeric characters for storage/calculation.
 */
export function stripNonNumeric(value: string): string {
  return value.replace(/[^0-9]/g, "");
}

/**
 * Formats a number as a currency string with million units.
 * Guarantees comma for thousands and period for decimal.
 */
export function formatMillion(value: number, decimals: number = 2) {
  const MillionsVal = value / 1000000;
  
  // Use toFixed to get the right decimal length
  const rounded = MillionsVal.toFixed(decimals);
  
  // Split into integer and fractional parts
  const [integerPart, fractionalPart] = rounded.split(".");
  
  // Add comma as thousands separator using regex
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  
  return fractionalPart ? `${formattedInteger}.${fractionalPart}` : formattedInteger;
}

/**
 * Spells out a number in Indonesian (Terbilang).
 */
export function terbilang(n: number): string {
  const units = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tuju", "delapan", "sembilan"];
  const teens = ["sepuluh", "sebelas", "dua belas", "tiga belas", "empat belas", "lima belas", "enam belas", "tujuh belas", "delapan belas", "sembilan belas"];
  
  function spell(num: number): string {
    if (num === 0) return "";
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) return spell(Math.floor(num / 10)) + " puluh " + spell(num % 10);
    if (num < 200) return "seratus " + spell(num - 100);
    if (num < 1000) return spell(Math.floor(num / 100)) + " ratus " + spell(num % 100);
    if (num < 2000) return "seribu " + spell(num - 1000);
    if (num < 1000000) return spell(Math.floor(num / 1000)) + " ribu " + spell(num % 1000);
    if (num < 1000000000) return spell(Math.floor(num / 1000000)) + " juta " + spell(num % 1000000);
    if (num < 1000000000000) return spell(Math.floor(num / 1000000000)) + " milyar " + spell(num % 1000000000);
    return "";
  }

  const result = spell(Math.floor(n)).trim().replace(/\s+/g, " ");
  return result ? result.replace(/tuju/g, "tujuh") + " rupiah" : "nol rupiah";
}
