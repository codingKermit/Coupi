import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { RootNavigator } from './src/navigation/RootNavigator';
import { useSession } from './src/auth/session';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 쿠폰은 자주 바뀌지 않는다. 화면을 오갈 때마다 다시 받지 않는다.
      staleTime: 60_000,
      // 인증 오류는 재시도해도 같으므로 한 번만 더 해본다.
      retry: 1,
    },
  },
});

export default function App() {
  const restore = useSession((s) => s.restore);

  // 저장된 세션 토큰을 복원한 뒤에 화면을 가른다.
  useEffect(() => {
    void restore();
  }, [restore]);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
