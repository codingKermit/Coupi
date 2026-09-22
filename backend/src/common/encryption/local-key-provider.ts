import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { KeyProvider } from './key-provider.interface';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;
const MASTER_KEY_BYTES = 32;

/**
 * 환경변수 마스터 키로 DEK를 감싼다. **로컬 개발과 테스트 전용이다.**
 *
 * 운영에서는 `KmsKeyProvider`를 쓴다 — 마스터 키가 프로세스 메모리에 평문으로 존재하지
 * 않아야 하고, 키 로테이션·감사 로그를 KMS에 맡겨야 하기 때문이다 (`docs/07-보안개인정보.md`).
 */
@Injectable()
export class LocalKeyProvider implements KeyProvider {
  readonly name = 'local';
  private readonly masterKey: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('ENCRYPTION_MASTER_KEY') ?? '';
    const key = Buffer.from(raw, 'base64');

    if (key.length !== MASTER_KEY_BYTES) {
      throw new Error(
        `ENCRYPTION_MASTER_KEY는 base64로 인코딩된 ${MASTER_KEY_BYTES}바이트여야 한다 ` +
          `(현재 ${key.length}바이트). 생성: openssl rand -base64 32`,
      );
    }

    this.masterKey = key;
  }

  async wrapDek(dek: Buffer): Promise<string> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);

    return Buffer.concat([iv, cipher.getAuthTag(), wrapped]).toString('base64');
  }

  async unwrapDek(wrapped: string): Promise<Buffer> {
    const raw = Buffer.from(wrapped, 'base64');

    const iv = raw.subarray(0, IV_BYTES);
    const authTag = raw.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
    const payload = raw.subarray(IV_BYTES + AUTH_TAG_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.masterKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(payload), decipher.final()]);
  }
}
