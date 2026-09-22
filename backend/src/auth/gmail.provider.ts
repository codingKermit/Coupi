import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { google, type gmail_v1 } from 'googleapis';

import { extractBody, toRawMailMessage } from './gmail-message.util';
import {
  HistoryExpiredError,
  ReauthRequiredError,
  type FetchResult,
  type MailBody,
  type MailProvider,
  type ProviderCursor,
  type ProviderTokenSet,
  type RawMailMessage,
  type WatchHandle,
} from './mail-provider.interface';

/**
 * 요청 스코프는 읽기 전용 하나로 고정한다.
 * `gmail.modify`, `gmail.send`는 어떤 경우에도 요청하지 않는다 (`docs/07-보안개인정보.md`).
 */
export const GMAIL_SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

/** Gmail watch 구독은 7일 후 만료된다 (`docs/01-메일연동.md`). */
export const WATCH_TTL_DAYS = 7;

/** history.list / messages.list 한 번에 가져올 최대 건수. */
const PAGE_SIZE = 100;

/** 한 번의 수집에서 처리할 메시지 상한. 폭주 시 안전장치. */
const MAX_MESSAGES_PER_FETCH = 500;

@Injectable()
export class GmailProvider implements MailProvider {
  readonly providerName = 'gmail' as const;
  private readonly logger = new Logger(GmailProvider.name);

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly watchTopic: string;

  constructor(config: ConfigService) {
    this.clientId = config.getOrThrow<string>('GMAIL_OAUTH_CLIENT_ID');
    this.clientSecret = config.getOrThrow<string>('GMAIL_OAUTH_CLIENT_SECRET');
    this.redirectUri = config.getOrThrow<string>('GMAIL_OAUTH_REDIRECT_URI');

    const projectId = config.getOrThrow<string>('GCP_PROJECT_ID');
    const topic =
      config.get<string>('PUBSUB_TOPIC_GMAIL_NOTIFICATIONS') ??
      'gmail-notifications';
    this.watchTopic = `projects/${projectId}/topics/${topic}`;
  }

  getAuthUrl(state: string): string {
    return this.newClient().generateAuthUrl({
      access_type: 'offline',
      scope: GMAIL_SCOPES,
      state,
      // 이미 동의한 사용자에게도 refresh token을 다시 받기 위해 필요하다.
      prompt: 'consent',
      include_granted_scopes: true,
    });
  }

  async exchangeCodeForToken(code: string): Promise<ProviderTokenSet> {
    const { tokens } = await this.newClient().getToken(code);

    if (!tokens.refresh_token) {
      // access_type=offline + prompt=consent면 반드시 와야 한다.
      // 없으면 이후 토큰 갱신이 불가능해 수집이 7일 뒤 멈춘다.
      throw new Error(
        'Google이 refresh token을 주지 않았다. OAuth 동의 화면 설정을 확인할 것.',
      );
    }

    return this.toTokenSet(
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date,
      tokens.scope,
    );
  }

  async refreshAccessToken(refreshToken: string): Promise<ProviderTokenSet> {
    const client = this.newClient();
    client.setCredentials({ refresh_token: refreshToken });

    try {
      const { credentials } = await client.refreshAccessToken();
      return this.toTokenSet(
        credentials.access_token,
        credentials.refresh_token ?? refreshToken,
        credentials.expiry_date,
        credentials.scope,
      );
    } catch (error) {
      // 사용자가 Google 계정 설정에서 접근을 취소하면 invalid_grant가 온다 (docs/08).
      if (this.isInvalidGrant(error)) {
        throw new ReauthRequiredError('invalid_grant');
      }
      throw error;
    }
  }

  async revokeToken(refreshToken: string): Promise<void> {
    try {
      await this.newClient().revokeToken(refreshToken);
    } catch (error) {
      // 이미 폐기된 토큰이면 목적은 달성된 것이므로 실패로 보지 않는다.
      this.logger.warn(
        `토큰 폐기 실패(이미 폐기되었을 수 있음): ${this.describeError(error)}`,
      );
    }
  }

  async registerWatch(token: ProviderTokenSet): Promise<WatchHandle> {
    const gmail = this.gmailFor(token);

    const { data } = await this.call(() =>
      gmail.users.watch({
        userId: 'me',
        requestBody: { topicName: this.watchTopic, labelIds: ['INBOX'] },
      }),
    );

    if (!data.historyId) {
      throw new Error('watch 응답에 historyId가 없다.');
    }

    return {
      historyId: String(data.historyId),
      expiresAt: data.expiration
        ? new Date(Number(data.expiration))
        : new Date(Date.now() + WATCH_TTL_DAYS * 86_400_000),
    };
  }

  async fetchNewMessages(
    token: ProviderTokenSet,
    cursor: ProviderCursor,
  ): Promise<FetchResult> {
    const gmail = this.gmailFor(token);
    const messageIds = new Set<string>();

    let pageToken: string | undefined;
    let latestHistoryId = cursor.historyId;

    do {
      const { data } = await this.call(
        () =>
          gmail.users.history.list({
            userId: 'me',
            startHistoryId: cursor.historyId,
            historyTypes: ['messageAdded'],
            labelId: 'INBOX',
            maxResults: PAGE_SIZE,
            pageToken,
          }),
        cursor.historyId,
      );

      if (data.historyId) latestHistoryId = String(data.historyId);

      for (const entry of data.history ?? []) {
        for (const added of entry.messagesAdded ?? []) {
          const id = added.message?.id;
          if (id) messageIds.add(id);
        }
      }

      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken && messageIds.size < MAX_MESSAGES_PER_FETCH);

    return {
      messages: await this.fetchMetadata(gmail, [...messageIds]),
      nextCursor: { historyId: latestHistoryId },
    };
  }

  async fetchMessagesSince(
    token: ProviderTokenSet,
    since: Date,
  ): Promise<FetchResult> {
    const gmail = this.gmailFor(token);
    const messageIds: string[] = [];

    let pageToken: string | undefined;

    do {
      const { data } = await this.call(() =>
        gmail.users.messages.list({
          userId: 'me',
          labelIds: ['INBOX'],
          // Gmail 검색의 after는 초 단위 epoch을 받는다.
          q: `after:${Math.floor(since.getTime() / 1000)}`,
          maxResults: PAGE_SIZE,
          pageToken,
        }),
      );

      for (const m of data.messages ?? []) {
        if (m.id) messageIds.push(m.id);
      }

      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken && messageIds.length < MAX_MESSAGES_PER_FETCH);

    // 재동기화를 마쳤으니 커서를 계정의 최신 historyId로 맞춘다.
    const { data: profile } = await this.call(() =>
      gmail.users.getProfile({ userId: 'me' }),
    );

    return {
      messages: await this.fetchMetadata(gmail, messageIds),
      nextCursor: { historyId: String(profile.historyId ?? '') },
    };
  }

  async fetchMessageBody(
    token: ProviderTokenSet,
    messageId: string,
  ): Promise<MailBody> {
    const gmail = this.gmailFor(token);

    const { data } = await this.call(() =>
      gmail.users.messages.get({ userId: 'me', id: messageId, format: 'full' }),
    );

    return extractBody(data.payload ?? undefined);
  }

  // ---------------------------------------------------------------- 내부 구현

  private newClient(): OAuth2Client {
    return new OAuth2Client(this.clientId, this.clientSecret, this.redirectUri);
  }

  private gmailFor(token: ProviderTokenSet): gmail_v1.Gmail {
    const client = this.newClient();
    client.setCredentials({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      expiry_date: token.expiresAt.getTime(),
    });

    return google.gmail({ version: 'v1', auth: client });
  }

  /** 제목/발신자/수신시각만 필요하므로 metadata 포맷으로 가져온다. */
  private async fetchMetadata(
    gmail: gmail_v1.Gmail,
    ids: string[],
  ): Promise<RawMailMessage[]> {
    const messages: RawMailMessage[] = [];

    for (const id of ids) {
      const { data } = await this.call(() =>
        gmail.users.messages.get({
          userId: 'me',
          id,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        }),
      );

      const parsed = toRawMailMessage(data);
      if (parsed) messages.push(parsed);
    }

    return messages;
  }

  /**
   * Gmail API 오류를 도메인 오류로 번역한다.
   * 404는 historyId 만료를 뜻하므로 전체 재동기화 신호로 바꾼다 (`docs/01`, `docs/08`).
   */
  private async call<T>(fn: () => Promise<T>, cursor?: string): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      const status = this.statusOf(error);

      if (status === 404 && cursor) {
        throw new HistoryExpiredError(cursor);
      }
      if (status === 401 || this.isInvalidGrant(error)) {
        throw new ReauthRequiredError(`Gmail API ${status ?? 'invalid_grant'}`);
      }

      throw error;
    }
  }

  private statusOf(error: unknown): number | undefined {
    if (typeof error !== 'object' || error === null) return undefined;

    const status = (error as { status?: unknown }).status;
    if (typeof status === 'number') return status;

    const code = (error as { code?: unknown }).code;
    if (typeof code === 'number') return code;

    return undefined;
  }

  private isInvalidGrant(error: unknown): boolean {
    return this.describeError(error).includes('invalid_grant');
  }

  private describeError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private toTokenSet(
    accessToken: string | null | undefined,
    refreshToken: string,
    expiryDate: number | null | undefined,
    scope: string | null | undefined,
  ): ProviderTokenSet {
    if (!accessToken) {
      throw new Error('access token이 없다.');
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: new Date(expiryDate ?? Date.now() + 3600_000),
      scope: scope ? scope.split(' ') : GMAIL_SCOPES,
    };
  }
}
