/** 화면 전반에서 쓰는 최소한의 값. 디자인 시스템이 생기면 여기부터 교체한다. */
export const theme = {
  color: {
    bg: '#FFFFFF',
    surface: '#F7F8FA',
    border: '#E5E7EB',
    text: '#111827',
    textMuted: '#6B7280',
    primary: '#2563EB',
    danger: '#DC2626',
    warning: '#D97706',
  },
  space: (n: number) => n * 4,
  radius: 12,
} as const;
