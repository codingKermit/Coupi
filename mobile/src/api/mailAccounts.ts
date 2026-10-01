import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiRequest } from './client';
import { useSession } from '../auth/session';
import type { MailAccountSummary } from './types';

export const mailAccountKeys = {
  all: ['mailAccounts'] as const,
};

export function useMailAccounts() {
  const token = useSession((s) => s.token);

  return useQuery({
    queryKey: mailAccountKeys.all,
    enabled: Boolean(token),
    queryFn: async () => {
      const data = await apiRequest<{ mailAccounts: MailAccountSummary[] }>(
        '/mail-accounts',
        { token },
      );
      return data.mailAccounts;
    },
  });
}

export function useDisconnectMailAccount() {
  const token = useSession((s) => s.token);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      apiRequest<void>(`/mail-accounts/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      // 연결을 끊으면 쿠폰도 함께 사라진다 (CASCADE) — 둘 다 다시 받는다.
      await queryClient.invalidateQueries({ queryKey: mailAccountKeys.all });
      await queryClient.invalidateQueries({ queryKey: ['coupons'] });
    },
  });
}
