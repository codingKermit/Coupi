import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';

import type { NotificationContent } from './notification-message.util';
import type { NotificationType } from '../common/types/domain';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';

/** 재시도해도 결과가 같은 실패 — 토큰이 죽었거나 페이로드가 잘못된 경우. */
export type SendFailure = {
  ok: false;
  /** true면 재시도하지 않는다 (`docs/04-푸시알림.md` "재시도 및 실패 정책"). */
  permanent: boolean;
  /** 디바이스 레코드를 지워야 하는 경우 */
  unregistered: boolean;
  reason: string;
};

export type SendResult = { ok: true } | SendFailure;

export interface SendRequest {
  fcmToken: string;
  content: NotificationContent;
  couponId: string;
  notificationType: NotificationType;
}

/**
 * FCM HTTP v1 발송 (`docs/04-푸시알림.md`).
 *
 * iOS도 FCM이 APNs로 중계하므로 SDK는 하나만 쓴다. firebase-admin 대신
 * 애플리케이션 기본 자격증명 + fetch를 쓴다 — Cloud Run에서 서비스 계정이 이미 붙어 있어
 * 별도 키 파일이 필요 없고, 의존성도 늘지 않는다.
 */
@Injectable()
export class FcmClient {
  private readonly logger = new Logger(FcmClient.name);
  private readonly auth = new GoogleAuth({ scopes: [FCM_SCOPE] });
  private readonly endpoint: string;
  private readonly deeplinkScheme: string;

  constructor(config: ConfigService) {
    const projectId = config.getOrThrow<string>('GCP_PROJECT_ID');
    this.endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    this.deeplinkScheme = config.get<string>('APP_DEEPLINK_SCHEME') ?? 'coupi';
  }

  async send(request: SendRequest): Promise<SendResult> {
    const body = {
      message: {
        token: request.fcmToken,
        notification: {
          title: request.content.title,
          body: request.content.body,
        },
        data: {
          type: request.notificationType,
          couponId: request.couponId,
          deeplink: `${this.deeplinkScheme}://coupons/${request.couponId}`,
        },
        android: { priority: 'high' },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default' } },
        },
      },
    };

    let response: Response;

    try {
      const token = await this.auth.getAccessToken();
      response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token ?? ''}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      // 네트워크 오류는 일시적으로 본다 — Cloud Tasks가 백오프 후 재시도한다.
      return {
        ok: false,
        permanent: false,
        unregistered: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    if (response.ok) return { ok: true };

    return this.toFailure(response.status, await response.text());
  }

  private toFailure(status: number, rawBody: string): SendFailure {
    const errorCode = this.errorCodeOf(rawBody);
    const unregistered =
      errorCode === 'UNREGISTERED' || errorCode === 'NOT_FOUND' || status === 404;

    // 4xx는 재시도해도 같은 결과다. 5xx와 429만 재시도 대상으로 둔다.
    const permanent = unregistered || (status >= 400 && status < 500 && status !== 429);

    this.logger.warn(
      `FCM 발송 실패 status=${status} code=${errorCode ?? '(없음)'} permanent=${permanent}`,
    );

    return {
      ok: false,
      permanent,
      unregistered,
      reason: errorCode ?? `HTTP ${status}`,
    };
  }

  /** FCM v1 오류 본문에서 errorCode를 꺼낸다. 형식이 달라도 죽지 않게 한다. */
  private errorCodeOf(rawBody: string): string | null {
    try {
      const parsed = JSON.parse(rawBody) as {
        error?: { status?: string; details?: { errorCode?: string }[] };
      };

      const detail = parsed.error?.details?.find((d) => d.errorCode)?.errorCode;
      return detail ?? parsed.error?.status ?? null;
    } catch {
      return null;
    }
  }
}
