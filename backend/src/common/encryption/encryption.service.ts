import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { KEY_PROVIDER, type KeyProvider } from './key-provider.interface';

const ALGORITHM = 'aes-256-gcm';
const DEK_BYTES = 32;
const IV_BYTES = 12;
const ENVELOPE_VERSION = 'v1';

/**
 * 평문 DEK를 메모리에 두는 시간. `docs/07-보안개인정보.md`가 정한 값으로,
 * KMS 호출량과 평문 키가 메모리에 머무는 시간 사이의 절충이다.
 */
const DEK_CACHE_TTL_MS = 5 * 60 * 1000;

interface CachedDek {
  dek: Buffer;
  wrapped: string;
  createdAt: number;
}

/**
 * Gmail refresh token 같은 민감값을 AES-256-GCM으로 암호화한다
 * (`docs/07-보안개인정보.md` envelope encryption).
 *
 * 저장 형식: v1:<wrappedDek>:<iv>:<authTag>:<ciphertext> (각 필드 base64)
 *
 * 암호문마다 자기가 쓴 DEK를 감싼 채로 들고 다니므로, DEK를 로테이션해도 기존 암호문을
 * 일괄 재암호화할 필요가 없다. 토큰이 실제로 갱신될 때 새 DEK로 다시 저장되면서
 * 자연스럽게 재암호화된다 — docs/07의 지연 재암호화(lazy re-encryption) 방식이다.
 */
@Injectable()
export class EncryptionService {
  private currentDek: CachedDek | null = null;
  private readonly unwrapCache = new Map<
    string,
    { dek: Buffer; createdAt: number }
  >();

  constructor(
    @Inject(KEY_PROVIDER) private readonly keyProvider: KeyProvider,
  ) {}

  async encrypt(plaintext: string): Promise<string> {
    const { dek, wrapped } = await this.getCurrentDek();

    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, dek, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    return [
      ENVELOPE_VERSION,
      wrapped,
      iv.toString('base64'),
      cipher.getAuthTag().toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  async decrypt(envelope: string): Promise<string> {
    const parts = envelope.split(':');

    if (parts.length !== 5 || parts[0] !== ENVELOPE_VERSION) {
      throw new Error('암호문 형식이 올바르지 않다.');
    }

    const [, wrapped, ivB64, authTagB64, ciphertextB64] = parts;
    const dek = await this.unwrapDek(wrapped);

    const decipher = createDecipheriv(
      ALGORITHM,
      dek,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  }

  /** 평문 키를 메모리에서 지운다. 테스트와 종료 시 사용. */
  clearKeyCache(): void {
    this.currentDek?.dek.fill(0);
    this.currentDek = null;

    for (const entry of this.unwrapCache.values()) entry.dek.fill(0);
    this.unwrapCache.clear();
  }

  private async getCurrentDek(): Promise<CachedDek> {
    if (
      this.currentDek &&
      Date.now() - this.currentDek.createdAt < DEK_CACHE_TTL_MS
    ) {
      return this.currentDek;
    }

    const dek = randomBytes(DEK_BYTES);
    const wrapped = await this.keyProvider.wrapDek(dek);

    this.currentDek = { dek, wrapped, createdAt: Date.now() };

    return this.currentDek;
  }

  private async unwrapDek(wrapped: string): Promise<Buffer> {
    const cached = this.unwrapCache.get(wrapped);
    if (cached && Date.now() - cached.createdAt < DEK_CACHE_TTL_MS) {
      return cached.dek;
    }

    const dek = await this.keyProvider.unwrapDek(wrapped);
    this.unwrapCache.set(wrapped, { dek, createdAt: Date.now() });

    return dek;
  }
}
