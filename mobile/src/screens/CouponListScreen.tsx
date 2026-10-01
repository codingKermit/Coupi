import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCoupons } from '../api/coupons';
import { useMailAccounts } from '../api/mailAccounts';
import { theme } from '../theme';
import type { Coupon, CouponFilter } from '../api/types';

/** 탭 구성은 `docs/06-모바일앱구조.md` "쿠폰 목록"을 따른다. */
const TABS: { key: CouponFilter; label: string }[] = [
  { key: 'active', label: '사용 가능' },
  { key: 'expiring', label: '만료 임박' },
  { key: 'expired', label: '지난 쿠폰' },
];

/** 만료일까지 남은 일수. 서버가 ISO 날짜를 주므로 로컬 기준으로 센다. */
function daysLeft(expiryDate: string | null): number | null {
  if (!expiryDate) return null;

  const [y, m, d] = expiryDate.split('-').map(Number);
  const today = new Date();
  const diff =
    Date.UTC(y, m - 1, d) -
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());

  return Math.round(diff / 86_400_000);
}

function DdayBadge({ expiryDate }: { expiryDate: string | null }) {
  const left = daysLeft(expiryDate);
  if (left === null) return null;

  const label = left < 0 ? '만료됨' : left === 0 ? '오늘까지' : `D-${left}`;
  // 3일 이내는 눈에 띄게 한다 — 만료 임박이 이 앱의 핵심 가치다.
  const color =
    left < 0
      ? theme.color.textMuted
      : left <= 3
        ? theme.color.danger
        : theme.color.textMuted;

  return <Text style={[styles.badge, { color }]}>{label}</Text>;
}

function CouponCard({
  coupon,
  onPress,
}: {
  coupon: Coupon;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.brand} numberOfLines={1}>
          {coupon.brandName}
        </Text>
        <DdayBadge expiryDate={coupon.expiryDate} />
      </View>

      {coupon.discount ? (
        <Text style={styles.discount}>{coupon.discount} 할인</Text>
      ) : (
        <Text style={styles.discountMuted}>할인 정보 없음</Text>
      )}

      {coupon.conditions ? (
        <Text style={styles.conditions} numberOfLines={1}>
          {coupon.conditions}
        </Text>
      ) : null}
    </Pressable>
  );
}

/**
 * 메일 연결이 끊긴 계정이 있으면 홈 상단에 띄운다
 * (docs/06-모바일앱구조.md "에러/엣지케이스 UI").
 *
 * 이 배너가 없으면 사용자는 쿠폰이 안 오는 이유를 알 수 없다 — 토큰이 폐기되면
 * 수집이 조용히 멈추기 때문이다 (docs/08).
 */
function ReauthBanner() {
  const { data: accounts } = useMailAccounts();
  const broken = accounts?.filter((a) => a.needsReauth) ?? [];

  if (broken.length === 0) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.bannerTitle}>메일 연결을 다시 확인해주세요</Text>
      <Text style={styles.bannerBody}>
        {broken.map((a) => a.email).join(", ")} 계정의 연결이 끊겨 새 쿠폰을
        받지 못하고 있어요. 설정에서 다시 연결해주세요.
      </Text>
    </View>
  );
}

export function CouponListScreen({
  onSelect,
}: {
  onSelect: (id: string) => void;
}) {
  const [filter, setFilter] = useState<CouponFilter>('active');
  const { data, isLoading, isRefetching, refetch, error } = useCoupons(filter);

  return (
    <View style={styles.screen}>
      <ReauthBanner />

      <View style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setFilter(tab.key)}
            style={[styles.tab, filter === tab.key && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabLabel,
                filter === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator style={styles.center} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{(error as Error).message}</Text>
          <Pressable onPress={() => void refetch()} style={styles.retry}>
            <Text style={styles.retryLabel}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <CouponCard coupon={item} onPress={() => onSelect(item.id)} />
          )}
          // 푸시를 못 받았을 때를 대비한 수동 갱신 (docs/06)
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => void refetch()}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>아직 도착한 쿠폰이 없어요</Text>
              <Text style={styles.emptyBody}>
                메일 연결 상태를 설정에서 확인해 보세요.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.color.bg },
  banner: {
    margin: theme.space(4),
    marginBottom: 0,
    padding: theme.space(4),
    borderRadius: theme.radius,
    backgroundColor: "#FEF3C7",
    gap: theme.space(1),
  },
  bannerTitle: { fontWeight: "700", color: theme.color.warning },
  bannerBody: { fontSize: 13, color: theme.color.text, lineHeight: 19 },
  tabs: {
    flexDirection: 'row',
    gap: theme.space(2),
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(3),
  },
  tab: {
    paddingHorizontal: theme.space(3),
    paddingVertical: theme.space(2),
    borderRadius: theme.radius,
    backgroundColor: theme.color.surface,
  },
  tabActive: { backgroundColor: theme.color.primary },
  tabLabel: { color: theme.color.textMuted, fontSize: 14 },
  tabLabelActive: { color: '#FFFFFF', fontWeight: '600' },
  list: { padding: theme.space(4), gap: theme.space(3) },
  card: {
    padding: theme.space(4),
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.color.border,
    gap: theme.space(1),
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  brand: { fontSize: 15, fontWeight: '600', color: theme.color.text, flex: 1 },
  badge: { fontSize: 13, fontWeight: '600' },
  discount: { fontSize: 20, fontWeight: '700', color: theme.color.text },
  discountMuted: { fontSize: 15, color: theme.color.textMuted },
  conditions: { fontSize: 13, color: theme.color.textMuted },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: theme.space(8), gap: theme.space(2) },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: theme.color.text },
  emptyBody: { fontSize: 14, color: theme.color.textMuted, textAlign: 'center' },
  errorText: { color: theme.color.danger, textAlign: 'center' },
  retry: {
    paddingHorizontal: theme.space(4),
    paddingVertical: theme.space(2),
    backgroundColor: theme.color.surface,
    borderRadius: theme.radius,
  },
  retryLabel: { color: theme.color.text },
});
