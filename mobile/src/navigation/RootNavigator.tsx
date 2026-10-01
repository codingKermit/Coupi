import { ActivityIndicator, View } from 'react-native';
import {
  NavigationContainer,
  useNavigation,
  type LinkingOptions,
  type NavigatorScreenParams,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createNativeStackNavigator,
  type NativeStackNavigationProp,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';

import { CouponDetailScreen } from '../screens/CouponDetailScreen';
import { CouponListScreen } from '../screens/CouponListScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { useSession } from '../auth/session';

export type TabParamList = {
  Home: undefined;
  Settings: undefined;
};

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  CouponDetail: { couponId: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

/**
 * 딥링크 (`docs/06-모바일앱구조.md` "딥링크 스킴").
 * 문서는 `myapp://`으로 적었지만 앱 이름 확정에 맞춰 `coupi://`를 쓴다.
 * 푸시 페이로드의 `data.deeplink`와 같은 스킴이어야 한다 (`docs/04`).
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['coupi://'],
  config: {
    screens: {
      Tabs: {
        screens: { Home: 'coupons', Settings: 'settings' },
      },
      CouponDetail: 'coupons/:couponId',
    },
  },
};

function HomeScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <CouponListScreen
      onSelect={(couponId) => navigation.navigate('CouponDetail', { couponId })}
    />
  );
}

function DetailScreen({
  route,
}: NativeStackScreenProps<RootStackParamList, 'CouponDetail'>) {
  return <CouponDetailScreen couponId={route.params.couponId} />;
}

function Tabs() {
  return (
    <Tab.Navigator screenOptions={{ headerTitleAlign: 'center' }}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '쿠폰' }} />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정' }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { token, isLoading } = useSession();

  // 저장소에서 토큰을 복원하기 전에는 온보딩/홈을 가를 수 없다.
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <NavigationContainer linking={linking}>
      {token ? (
        <Stack.Navigator>
          <Stack.Screen
            name="Tabs"
            component={Tabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CouponDetail"
            component={DetailScreen}
            options={{ title: '쿠폰 상세' }}
          />
        </Stack.Navigator>
      ) : (
        <OnboardingScreen />
      )}
    </NavigationContainer>
  );
}

const styles = { loading: { flex: 1, justifyContent: 'center' } } as const;
