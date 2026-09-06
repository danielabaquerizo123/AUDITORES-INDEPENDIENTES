import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ComparativeResult {
  difference: Prisma.Decimal | null;
  percentageChange: Prisma.Decimal | null;
}

/**
 * Comparativos deterministas con Decimal (nunca float inseguro):
 * difference = current - previous;
 * percentageChange = difference / previous * 100.
 * Con previous = 0 (o ausente) NO se divide: percentageChange = null.
 */
@Injectable()
export class ComparativeService {
  compare(
    current: Prisma.Decimal | null,
    previous: Prisma.Decimal | null,
  ): ComparativeResult {
    if (current === null || previous === null) {
      return { difference: null, percentageChange: null };
    }
    const difference = current.minus(previous);
    if (previous.isZero()) {
      return { difference, percentageChange: null };
    }
    const percentageChange = difference.div(previous).mul(100);
    return { difference, percentageChange };
  }
}
