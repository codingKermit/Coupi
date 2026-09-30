import { IsIn, IsOptional } from 'class-validator';

/** 목록 화면의 탭에 대응한다 (`docs/06-모바일앱구조.md` "쿠폰 목록"). */
export const COUPON_FILTERS = ['active', 'expiring', 'expired'] as const;
export type CouponFilter = (typeof COUPON_FILTERS)[number];

export const COUPON_SORTS = ['expiry_asc', 'created_desc'] as const;
export type CouponSort = (typeof COUPON_SORTS)[number];

export class ListCouponsDto {
  @IsOptional()
  @IsIn(COUPON_FILTERS)
  status?: CouponFilter;

  @IsOptional()
  @IsIn(COUPON_SORTS)
  sort?: CouponSort;
}
