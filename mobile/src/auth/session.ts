import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

/**
 * 앱 세션 토큰 보관.
 *
 * 토큰은 `SecureStore`에 둔다 — iOS 키체인 / Android 키스토어에 저장되므로
 * AsyncStorage처럼 평문 파일로 남지 않는다 (`docs/07-보안개인정보.md`의
 * 자격 증명 취급 원칙과 같은 맥락).
 */

const TOKEN_KEY = 'coupi.session.token';

interface SessionState {
  token: string | null;
  /** 저장소에서 복원하기 전에는 로그인 여부를 판단할 수 없다. */
  isLoading: boolean;
  restore: () => Promise<void>;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  token: null,
  isLoading: true,

  restore: async () => {
    try {
      set({ token: await SecureStore.getItemAsync(TOKEN_KEY) });
    } catch {
      // 키체인 접근이 실패해도 앱은 떠야 한다. 로그인 화면으로 보낸다.
      set({ token: null });
    } finally {
      set({ isLoading: false });
    }
  },

  signIn: async (token: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    set({ token });
  },

  signOut: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    set({ token: null });
  },
}));
