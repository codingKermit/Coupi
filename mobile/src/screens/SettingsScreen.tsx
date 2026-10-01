import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { apiRequest } from '../api/client';
import { theme } from '../theme';
import { useDisconnectMailAccount, useMailAccounts } from '../api/mailAccounts';
import { useSession } from '../auth/session';
import type { MailAccountSummary } from '../api/types';

/**
 * 설정 (`docs/06-모바일앱구조.md` "설정").
 *
 * 알림 토글은 하나뿐이다. 문서는 "신규 쿠폰 / 만료 임박"을 따로 두자고 했지만
 * 서버 API와 `users` 스키마가 단일 플래그라, 세분화하려면 양쪽을 함께 바꿔야 한다.
 */
export function SettingsScreen() {
  const { token, signOut } = useSession();
  const { data: accounts, isLoading } = useMailAccounts();
  const disconnect = useDisconnectMailAccount();
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const toggle = async (next: boolean) => {
    // 낙관적으로 먼저 반영하고, 실패하면 되돌린다.
    setEnabled(next);
    setSaving(true);

    try {
      await apiRequest('/users/me/notification-settings', {
        method: 'PATCH',
        body: { notificationsEnabled: next },
        token,
      });
    } catch (e) {
      setEnabled(!next);
      Alert.alert('알림 설정 실패', (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const confirmDisconnect = (account: MailAccountSummary) => {
    // 연결을 끊으면 쿠폰 기록도 함께 사라진다 — 사전 고지가 필요하다
    // (docs/07-보안개인정보.md 토큰 폐기 흐름 5단계).
    Alert.alert(
      '연결을 해제할까요?',
      `${account.email}\n\n그동안 받은 쿠폰 기록도 함께 삭제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '해제',
          style: 'destructive',
          onPress: () => {
            disconnect.mutate(account.id, {
              onError: (e) => Alert.alert('해제 실패', (e as Error).message),
            });
          },
        },
      ],
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.sectionTitle}>연결된 메일 계정</Text>

      {isLoading ? (
        <ActivityIndicator />
      ) : accounts?.length ? (
        accounts.map((account) => (
          <View key={account.id} style={styles.account}>
            <View style={styles.accountInfo}>
              <Text style={styles.accountEmail}>{account.email}</Text>
              <Text
                style={[
                  styles.accountStatus,
                  account.needsReauth && styles.accountStatusWarn,
                ]}
              >
                {account.needsReauth ? '재연결 필요' : '연결됨'}
              </Text>
            </View>
            <Pressable
              onPress={() => confirmDisconnect(account)}
              disabled={disconnect.isPending}
            >
              <Text style={styles.disconnect}>해제</Text>
            </Pressable>
          </View>
        ))
      ) : (
        <Text style={styles.note}>연결된 계정이 없습니다.</Text>
      )}

      <Text style={styles.sectionTitle}>알림</Text>
      <View style={styles.row}>
        <Text style={styles.label}>쿠폰 알림 받기</Text>
        <Switch
          value={enabled}
          disabled={saving}
          onValueChange={(v) => void toggle(v)}
        />
      </View>

      <Text style={styles.note}>현재 Gmail 계정만 지원합니다.</Text>

      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutLabel}>로그아웃</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: theme.space(5),
    gap: theme.space(3),
    backgroundColor: theme.color.bg,
    flexGrow: 1,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.color.textMuted,
    marginTop: theme.space(2),
  },
  account: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space(4),
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
  },
  accountInfo: { gap: theme.space(1), flex: 1 },
  accountEmail: { fontSize: 15, color: theme.color.text },
  accountStatus: { fontSize: 12, color: theme.color.textMuted },
  accountStatusWarn: { color: theme.color.warning, fontWeight: '600' },
  disconnect: { color: theme.color.danger, fontSize: 14, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.space(4),
    borderWidth: 1,
    borderColor: theme.color.border,
    borderRadius: theme.radius,
  },
  label: { fontSize: 15, color: theme.color.text },
  note: { fontSize: 13, color: theme.color.textMuted },
  signOut: {
    marginTop: 'auto',
    padding: theme.space(4),
    alignItems: 'center',
    borderRadius: theme.radius,
    backgroundColor: theme.color.surface,
  },
  signOutLabel: { color: theme.color.danger, fontWeight: '600' },
});
