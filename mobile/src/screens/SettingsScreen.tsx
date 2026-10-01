import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { apiRequest } from '../api/client';
import { theme } from '../theme';
import { useSession } from '../auth/session';

/**
 * 설정 (`docs/06-모바일앱구조.md` "설정").
 *
 * 알림 토글은 지금 하나뿐이다. 문서는 "신규 쿠폰 / 만료 임박"을 따로 두자고 했지만
 * 서버 API(`PATCH /users/me/notification-settings`)와 `users` 스키마가 단일 플래그라
 * 세분화하려면 양쪽을 함께 바꿔야 한다 — 베타에서 판단한다.
 */
export function SettingsScreen() {
  const { token, signOut } = useSession();
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

  return (
    <View style={styles.screen}>
      <View style={styles.row}>
        <Text style={styles.label}>쿠폰 알림 받기</Text>
        <Switch
          value={enabled}
          disabled={saving}
          onValueChange={(v) => void toggle(v)}
        />
      </View>

      <Text style={styles.note}>
        현재 Gmail 계정만 지원합니다.
      </Text>

      <Pressable style={styles.signOut} onPress={() => void signOut()}>
        <Text style={styles.signOutLabel}>로그아웃</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: theme.space(5), gap: theme.space(4), backgroundColor: theme.color.bg },
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
