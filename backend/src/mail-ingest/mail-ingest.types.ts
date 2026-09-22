/**
 * 수집 핸들러가 쓰는 타입을 한곳에 모아 재수출한다.
 * 제공자 구현(auth/)에 대한 import 경로를 얇게 유지하기 위한 것이다.
 */
export {
  HistoryExpiredError,
  ReauthRequiredError,
} from '../auth/mail-provider.interface';

export type {
  FetchResult,
  ProviderCursor,
  ProviderTokenSet,
  RawMailMessage,
} from '../auth/mail-provider.interface';

export type { MailAccountWithToken } from '../auth/mail-account-token.service';
