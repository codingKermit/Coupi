import { useQuery } from '@tanstack/react-query';

import { apiRequest } from './client';
import { useSession } from '../auth/session';
import type { Coupon, CouponFilter } from './types';

/** 목록과 상세가 같은 키 공간을 쓰도록 모아둔다. */
export const couponKeys = {
  all: ['coupons'] as const,
  list: (filter: CouponFilter) => ['coupons', 'list', filter] as const,
  detail: (id: string) => ['coupons', 'detail', id] as const,
};

export function useCoupons(filter: CouponFilter) {
  const token = useSession((s) => s.token);

  return useQuery({
    queryKey: couponKeys.list(filter),
    enabled: Boolean(token),
    queryFn: async () => {
      const data = await apiRequest<{ coupons: Coupon[] }>(
        `/coupons?status=${filter}`,
        { token },
      );
      return data.coupons;
    },
  });
}

export function useCoupon(id: string) {
  const token = useSession((s) => s.token);

  return useQuery({
    queryKey: couponKeys.detail(id),
    enabled: Boolean(token),
    queryFn: () => apiRequest<Coupon>(`/coupons/${id}`, { token }),
  });
}
