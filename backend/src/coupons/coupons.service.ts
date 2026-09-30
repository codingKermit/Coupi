import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';

import { PrismaService } from '../common/prisma/prisma.service';
import { toCouponDto, type CouponDto } from './coupon.dto';
import { toKstDateString } from '../coupon-classifier/validity-checker.service';
import type { CouponFilter, CouponSort } from './dto/list-coupons.dto';

/** "만료 임박" 탭의 기준 (`docs/06-모바일앱구조.md`). */
export const EXPIRING_WITHIN_DAYS = 3;

const SELECT = {
  id: true,
  discount: true,
  expiryDate: true,
  conditions: true,
  status: true,
  createdAt: true,
  processedMail: { select: { sender: true, providerMessageId: true } },
} as const;

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    userId: string,
    filter: CouponFilter = 'active',
    sort: CouponSort = 'expiry_asc',
    now: Date = new Date(),
  ): Promise<CouponDto[]> {
    const rows = await this.prisma.coupon.findMany({
      where: { userId, ...this.filterWhere(filter, now) },
      orderBy:
        sort === 'created_desc'
          ? { createdAt: 'desc' }
          : // 만료일이 없는 쿠폰은 뒤로 보낸다.
            [{ expiryDate: { sort: 'asc', nulls: 'last' } }, { createdAt: 'desc' }],
      select: SELECT,
    });

    return rows.map(toCouponDto);
  }

  async findOne(userId: string, couponId: string): Promise<CouponDto | null> {
    const row = await this.prisma.coupon.findFirst({
      // userId를 조건에 넣어 남의 쿠폰이 조회되지 않게 한다.
      where: { id: couponId, userId },
      select: SELECT,
    });

    return row ? toCouponDto(row) : null;
  }

  private filterWhere(
    filter: CouponFilter,
    now: Date,
  ): Prisma.CouponWhereInput {
    const today = new Date(`${toKstDateString(now)}T00:00:00Z`);

    if (filter === 'expired') {
      // 상태가 expired거나, 아직 active지만 만료일이 지난 것.
      // 만료 처리 배치를 따로 두지 않았으므로 조회 시점에 판단한다.
      return {
        OR: [{ status: 'expired' }, { expiryDate: { lt: today } }],
      };
    }

    const notExpired = {
      status: 'active',
      OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
    } satisfies Prisma.CouponWhereInput;

    if (filter === 'expiring') {
      const limit = new Date(
        today.getTime() + EXPIRING_WITHIN_DAYS * 86_400_000,
      );
      return {
        status: 'active',
        expiryDate: { gte: today, lte: limit },
      };
    }

    return notExpired;
  }
}
