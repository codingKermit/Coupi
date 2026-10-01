# 다른 PC에서 이어서 작업하기

Claude Code 대화는 기기에 묶여 있어 옮겨지지 않는다. 대신 **코드·문서·결정 근거가
모두 저장소에 있으므로** 이 문서대로 환경만 맞추면 그대로 이어갈 수 있다.

읽는 순서: 이 문서 → `PROGRESS.md`(현재 상태와 할 일) → `docs/00-개요.md`(설계 인덱스)

> Claude Code로 작업한다면 이 문서를 직접 따라 할 필요는 없다. 저장소 루트의
> `CLAUDE.md`를 세션 시작 시 자동으로 읽으므로, **새 세션을 열고 "이어서 진행해줘"라고만
> 하면 된다.** 이 문서는 사람이 직접 환경을 복원하거나 원인을 추적할 때 본다.

## 1. 저장소 받기

```bash
git clone git@github-personal:codingKermit/Coupi.git
```

개인 계정(`codingKermit`)과 회사 계정을 한 PC에서 함께 쓴다면 SSH 호스트 별칭을 둔다.
`~/.ssh/config`:

```
Host github-personal
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_personal
```

저장소 안에서 커밋 identity를 따로 지정한다:

```bash
git config --local user.name "codingKermit"
git config --local user.email "woojw6012@gmail.com"
```

## 2. `backend/.env` 복원

**이것만 저장소에 없다.** `backend/.env.example`을 복사해 값을 채운다.

| 키 | 어디서 | 주의 |
| --- | --- | --- |
| `DATABASE_URL` / `DIRECT_DATABASE_URL` | Neon 콘솔 → Connect | pooled / direct 두 개. **`channel_binding=disable&sslmode=verify-full`로 바꿔야 한다** (Prisma가 channel binding 미지원 — `prisma/README.md`) |
| `GMAIL_OAUTH_CLIENT_ID` / `_SECRET` | GCP 콘솔 → APIs & Services → Credentials | |
| `GMAIL_OAUTH_REDIRECT_URI` | | 기기 테스트 시 PC의 LAN 주소로. GCP 콘솔에도 같은 URI를 등록해야 한다 |
| **`ENCRYPTION_MASTER_KEY`** | **기존 PC의 `.env`에서 그대로 복사** | ⚠️ 아래 참고 |
| `SESSION_JWT_SECRET` | 새로 만들어도 된다 | 기존 앱 세션만 무효화된다 |
| 나머지 | `.env.example` 기본값 그대로 | |

### ENCRYPTION_MASTER_KEY를 꼭 옮겨야 하는 이유

Gmail refresh token은 이 키로 감싼 DEK로 암호화되어 Neon에 저장된다
(`docs/07-보안개인정보.md` envelope 암호화). **키가 바뀌면 기존 암호문을 풀 수 없다.**

옮기지 못했다면 치명적이진 않다. 새 키를 만들고 Gmail 계정을 다시 연결하면 된다:

```bash
curl -s http://localhost:8080/auth/gmail/url
```

기존 계정 레코드는 복호화 실패로 `reauth_required`가 되므로, 앱 설정에서 해제하거나
DB에서 지우고 새로 연결한다.

## 3. 백엔드 실행

```bash
cd backend
npm install
npx prisma generate
npm run build
npm run start:prod
```

마이그레이션은 **이미 Neon에 적용되어 있다.** 다시 돌릴 필요 없다.
스키마를 바꿀 때만 `prisma/README.md`의 CHECK 제약 절차를 따른다.

확인:

```bash
curl http://localhost:8080/health/ready
```

`{"status":"ok","database":"up"}`이면 정상이다.

## 4. 모바일 앱

```bash
cd mobile
npm install
```

빌드와 기기 연결 절차는 `mobile/README.md` 참고.

## 알아둘 함정

**PowerShell** — `&&`를 지원하지 않는다(5.1). `;`를 쓰거나 줄을 나눈다.
`npx`가 실행 정책에 막히면 `npx.cmd`로 호출한다.

**회사 네트워크의 TLS 검사** — 회사 네트워크에서는 게이트웨이가 HTTPS를 가로채
`api.expo.dev`와 Neon 연결이 인증서 검증에 실패한다. 회사 루트 인증서를 신뢰시키면 된다:

```
NODE_EXTRA_CA_CERTS=<회사 루트 CA .pem 경로>
```

**집/개인 네트워크에서는 이 설정이 필요 없다.** 가로채기가 네트워크 장비 쪽이라
경로가 바뀌면 사라진다. 확인:

```bash
node -e "require('tls').connect({host:'api.expo.dev',port:443,servername:'api.expo.dev',ca:require('tls').rootCertificates},function(){console.log(this.authorized?'정상':'가로채짐');this.end()}).on('error',e=>console.log('가로채짐'))"
```

덧붙여, 회사 네트워크에서는 Neon 트래픽도 복호화되어 지나간다. refresh token은
앱 계층에서 이미 암호화되어 안전하지만 **메일 제목·발신자·이메일 주소는 보인다.**
지인 계정으로 발신자 집계를 할 때는 개인 네트워크를 쓴다.

## 다음에 할 일

`PROGRESS.md` 맨 위의 "현재 상태"와 1단계 미완료 항목을 본다. 요약하면:

1. **GCP 결제 등록** — 인프라·Pub/Sub·FCM·수집 경로 E2E가 전부 여기 막혀 있다
2. **`backend/review-holds.csv` 검토** — 보류 33건이 진짜 쿠폰인지 사람이 판정해야
   전용 파서 작업 방향이 정해진다. 이 파일은 저장소에 없으니
   `npx ts-node scripts/review-holds.ts`로 다시 만들면 된다
3. **EAS Android 빌드** — 앱 실기기 확인 (`mobile/README.md`)
