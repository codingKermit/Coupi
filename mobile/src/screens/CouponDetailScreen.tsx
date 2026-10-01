import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCoupon } from '../api/coupons';
import { theme } from '../theme';

/**
 * 쿠폰 상세 (`docs/06-모바일앱구조.md` "쿠폰 상세").
 *
 * 다음 둘은 의도적으로 없다:
 * - 쿠폰 코드 복사 버튼 — 담을 컬럼도 추출 로직도 없다 (docs/06 미구현 메모)
 * - "사용 완료"/"숨기기"/피드백 — 3단계 베타 항목 (docs/00 결정 #3, #4)
 */
export function CouponDetailScreen({ couponId }: { couponId: string }) {
  const { data: coupon, isLoading, error } = useCoupon(couponId);

  if (isLoading) return <ActivityIndicator style={styles.center} />;

  if (error || !coupon) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>
          {error ? (error as Error).message : '쿠폰을 찾을 수 없어요'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.brand}>{coupon.brandName}</Text>
      <Text style={styles.discount}>
        {coupon.discount ? `${coupon.discount} 할인` : '할인 정보 없음'}
      </Text>

      <View style={styles.rows}>
        <Row label="만료일" value={coupon.expiryDate ?? '정보 없음'} />
        <Row label="사용 조건" value={coupon.conditions ?? '조건 없음'} />
        <Row label="상태" value={statusLabel(coupon.status)} />
      </View>

      {/* 본문을 앱에 저장하지 않으므로 원문은 항상 메일 제공자로 보낸다 (docs/06) */}
      <Pressable
        style={styles.linkButton}
        onPress={() => void Linking.openURL(coupon.sourceMailUrl)}
      >
        <Text style={styles.linkLabel}>원본 메일 보기</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case 'active':
      return '사용 가능';
    case 'expired':
      return '만료됨';
    case 'used':
      return '사용 완료';
    case 'dismissed':
      return '숨김';
    default:
      return status;
  }
}

const styles = StyleSheet.create({
  content: { padding: theme.space(5), gap: theme.space(4) },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space(8) },
  brand: { fontSize: 16, color: theme.color.textMuted },
  discount: { fontSize: 28, fontWeight: '700', color: theme.color.text },
  rows: {
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: theme.space(4),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  rowLabel: { color: theme.color.textMuted, fontSize: 14 },
  rowValue: { color: theme.color.text, fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  linkButton: {
    padding: theme.space(4),
    borderRadius: theme.radius,
    backgroundColor: theme.color.surface,
    alignItems: 'center',
  },
  linkLabel: { color: theme.color.primary, fontWeight: '600' },
  error: { color: theme.color.danger, textAlign: 'center' },
});
