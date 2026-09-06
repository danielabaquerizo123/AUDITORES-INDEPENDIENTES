import { Injectable } from '@nestjs/common';

const UNITS = [
  'cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve',
  'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete',
  'dieciocho', 'diecinueve', 'veinte',
];
const TENS = ['', '', 'veinti', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function belowThousand(n: number): string {
  if (n < UNITS.length) return UNITS[n];
  if (n < 30) return `${TENS[2]}${UNITS[n - 20]}`;
  if (n < 100) {
    const ten = Math.floor(n / 10);
    const rest = n % 10;
    return rest === 0 ? TENS[ten] : `${TENS[ten]} y ${UNITS[rest]}`;
  }
  if (n === 100) return 'cien';
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  const head = HUNDREDS[hundred];
  return rest === 0 ? head : `${head} ${belowThousand(rest)}`;
}

function integerToWords(n: number): string {
  if (n < 1000) return belowThousand(n);
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const head = thousands === 1 ? 'mil' : `${belowThousand(thousands)} mil`;
    return rest === 0 ? head : `${head} ${belowThousand(rest)}`;
  }
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const head = millions === 1 ? 'un millón' : `${integerToWords(millions)} millones`;
    return rest === 0 ? head : `${head} ${integerToWords(rest)}`;
  }
  throw new Error('Amount out of range');
}

function currencyWords(amount: number, currency: string): string {
  if (currency === 'USD') return amount === 1 ? 'dólar americano' : 'dólares americanos';
  return currency;
}

/**
 * Deterministic Spanish amount-to-words converter for contract fees.
 * Example: 1500 USD -> "Mil quinientos dólares americanos con 00/100".
 */
@Injectable()
export class AmountToWordsService {
  convert(amount: number | string, currency = 'USD'): string {
    const value = typeof amount === 'string' ? Number(amount) : amount;
    if (!Number.isFinite(value) || value < 0 || value >= 1_000_000_000) {
      throw new Error('Amount out of range');
    }
    const integer = Math.floor(value);
    const cents = Math.round((value - integer) * 100);
    const words = integerToWords(integer);
    const capitalized = words.charAt(0).toUpperCase() + words.slice(1);
    return `${capitalized} ${currencyWords(integer, currency)} con ${String(cents).padStart(2, '0')}/100`;
  }
}
