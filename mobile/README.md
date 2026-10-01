# 쿠피 모바일 앱

Expo(SDK 57) + React Native. 화면 구성은 `docs/06-모바일앱구조.md`를 따른다.

> 아직 **실기기에서 동작을 확인하지 않았다.** 타입 검사와 Android 번들 빌드까지만 통과한 상태다.

## 구조

```
src/
  api/        서버 호출 (client.ts) + React Query 훅
  auth/       세션 토큰 (SecureStore 보관)
  navigation/ 스택 + 탭
  screens/    온보딩 · 쿠폰 목록 · 쿠폰 상세 · 설정
```

- 서버 상태는 **React Query**, 세션은 **Zustand**
- 세션 토큰은 **SecureStore**(키체인/키스토어)에 둔다. AsyncStorage와 달리 평문 파일로 남지 않는다
- 서버 오류는 `{ error: { code, message } }` 한 형태다 (`docs/03`). 분기는 메시지가 아니라 `code`로 한다

## 개발 빌드 (EAS)

Expo Go로는 실행할 수 없다 — `expo-secure-store` 등 네이티브 모듈이 있어 development build가 필요하다.
macOS가 없어 iOS도 EAS 클라우드 빌드를 쓴다 (`docs/10-기술스택결정.md`).

```bash
npx eas-cli login      # Expo 계정 필요 (무료)
npx eas-cli init       # app.json에 projectId 추가
npx eas-cli build --platform android --profile development
```

첫 빌드에서 Android 키스토어 생성 여부를 묻는다. `Yes`면 EAS가 만들어 보관한다.
빌드는 클라우드에서 10~20분 걸리고 APK 링크가 나온다.

## 기기에서 백엔드에 연결하기

기기 입장에서 `localhost`는 기기 자신이다. 네 군데를 맞춰야 한다.

**1. `mobile/.env`** — 개발 PC의 LAN 주소

```
EXPO_PUBLIC_API_BASE_URL=http://<PC의_LAN_IP>:8080
```

기기와 PC가 같은 네트워크에 있어야 한다. Android 에뮬레이터는 `http://10.0.2.2:8080`으로 호스트에 접근한다.

**2. `backend/.env`** — OAuth 후 앱으로 복귀

```
OAUTH_SUCCESS_REDIRECT=coupi://auth/callback
GMAIL_OAUTH_REDIRECT_URI=http://<PC의_LAN_IP>:8080/auth/gmail/callback
```

**3. Google Cloud 콘솔** — APIs & Services → Credentials → OAuth 클라이언트의
승인된 리디렉션 URI에 위 주소를 **추가**한다 (기존 localhost는 남겨둔다).

**4. 방화벽** — PC가 8080 인바운드를 허용해야 한다.

### 실행

```bash
cd backend && npm run start:prod
```

```bash
cd mobile && npx expo start --dev-client
```

## 지금 이 빌드로 확인되는 것

쿠폰 목록은 **비어 있는 게 정상이다.** 수집 경로가 Pub/Sub를 필요로 하는데
GCP 결제가 등록되지 않아 돌지 않는다 (`PROGRESS.md` 1단계 블로킹 항목).

따라서 확인 대상은 앱이 뜨는지, OAuth 복귀가 되는지, 설정 화면에 연결 계정이
보이는지, 빈 목록 UI가 제대로 나오는지까지다.

## 미구현

- **FCM 푸시** — Firebase 연동 필요 (GCP 결제 이후)
- 재인증 배너 탭 시 재연결 플로우 — 현재는 안내만 하고 설정에서 해제·재연결
- 알림 종류별 토글 — 서버가 단일 플래그라 스키마와 함께 바꿔야 한다 (`docs/04`)
