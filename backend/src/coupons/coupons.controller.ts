import {
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CouponsService } from './coupons.service';
import { CurrentUser, SessionGuard } from '../auth/session.guard';
import { ListCouponsDto } from './dto/list-coupons.dto';
import type { CouponDto } from './coupon.dto';

/**
 * 쿠폰 조회 (`docs/03-API-DB-스펙.md` "쿠폰").
 *
 * `PATCH /coupons/:id`와 `POST /coupons/:id/feedback`은 3단계 베타에서 여는 것으로
 * 확정되어 있어(`docs/00-개요.md` 결정 #3, #4) 여기에 없다.
 */
@Controller('coupons')
@UseGuards(SessionGuard)
export class CouponsController {
  constructor(private readonly coupons: CouponsService) {}

  @Get()
  async list(
    @CurrentUser() userId: string,
    @Query() query: ListCouponsDto,
  ): Promise<{ coupons: CouponDto[] }> {
    return {
      coupons: await this.coupons.list(userId, query.status, query.sort),
    };
  }

  @Get(':id')
  async findOne(
    @CurrentUser() userId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CouponDto> {
    const coupon = await this.coupons.findOne(userId, id);
    if (!coupon) throw new NotFoundException();

    return coupon;
  }
}
