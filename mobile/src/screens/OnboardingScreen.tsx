import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { apiRequest } from '../api/client';
import { theme } from '../theme';
import { useSession } from '../auth/session';

/**
 * 온보딩 (`docs/06-모바일앱구조.md` "온보딩").
 *
 * 메일 서비스 선택 화면은 없다 — Gmail 단독이라 선택지가 없다 (docs/00 결정 #5).
 *
 * 흐름: `/auth/gmail/url`로 인증 URL을 받아 브라우저로 열고, 백엔드가 토큰 교환을
 * 마친 뒤 `coupi://auth/callback?token=...`으로 돌려보내면 그 토큰을 저장한다.
 * 백엔드의 `OAUTH_SUCCESS_REDIRECT`가 이 주소로 설정되어 있어야 한다.
 */
export function OnboardingScreen() {
  const signIn = useSession((s) => s.signIn);
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);

    try {
      const { url } = await apiRequest<{ url: string; state: string }>(
        '/auth/gmail/url',
      );

      const returnUrl = Linking.createURL('auth/callback');
      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);

      if (result.type !== 'success') {
        // 사용자가 브라우저를 닫은 경우. 오류가 아니므로 조용히 끝낸다.
        return;
      }

      const token = Linking.parse(result.url).queryParams?.token;
      if (typeof token !== 'string' || !token) {
        throw new Error('세션 토큰을 받지 못했습니다.');
      }

      await signIn(token);
    } catch (e) {
      Alert.alert('연결 실패', (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.title}>쿠피</Text>
        <Text style={styles.subtitle}>
          메일함에 쌓인 쿠폰, 쓸 수 있을 때 알려드려요
        </Text>
      </View>

      {/* 개인정보 신뢰 확보 — 동의 화면으로 넘어가기 전에 먼저 고지한다 (docs/06) */}
      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>메일 접근 안내</Text>
        <Text style={styles.noticeBody}>
          · 메일을 <Text style={styles.bold}>읽기 전용</Text>으로만 확인합니다{'\n'}
          · 메일 본문은 <Text style={styles.bold}>서버에 저장하지 않습니다</Text>
          {'\n'}· 쿠폰 정보만 추출해 보관합니다{'\n'}
          · 연결은 설정에서 언제든 해제할 수 있습니다
        </Text>
      </View>

      <Pressable
        style={[styles.cta, busy && styles.ctaBusy]}
        disabled={busy}
        onPress={() => void connect()}
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.ctaLabel}>Gmail로 시작하기</Text>
        )}
      </Pressable>

      <Text style={styles.footnote}>현재 Gmail 계정만 지원합니다.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: theme.space(6),
    gap: theme.space(5),
    justifyContent: 'center',
    backgroundColor: theme.color.bg,
  },
  hero: { gap: theme.space(2) },
  title: { fontSize: 36, fontWeight: '800', color: theme.color.text },
  subtitle: { fontSize: 16, color: theme.color.textMuted, lineHeight: 24 },
  notice: {
    padding: theme.space(4),
    borderRadius: theme.radius,
    backgroundColor: theme.color.surface,
    gap: theme.space(2),
  },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: theme.color.text },
  noticeBody: { fontSize: 13, color: theme.color.textMuted, lineHeight: 21 },
  bold: { fontWeight: '700', color: theme.color.text },
  cta: {
    padding: theme.space(4),
    borderRadius: theme.radius,
    backgroundColor: theme.color.primary,
    alignItems: 'center',
  },
  ctaBusy: { opacity: 0.7 },
  ctaLabel: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  footnote: { fontSize: 12, color: theme.color.textMuted, textAlign: 'center' },
});
