import { randomBytes } from 'node:crypto';

import { EncryptionService } from './encryption.service';
import type { KeyProvider } from './key-provider.interface';

/** DEK를 보관만 하는 테스트용 제공자. wrap/unwrap 호출 횟수를 센다. */
const fakeKeyProvider = () => {
  const store = new Map<string, Buffer>();
  const calls = { wrap: 0, unwrap: 0 };

  const provider: KeyProvider = {
    name: 'fake',
    wrapDek: async (dek) => {
      calls.wrap += 1;
      const handle = `wrapped-${store.size}`;
      store.set(handle, Buffer.from(dek));
      return handle;
    },
    unwrapDek: async (handle) => {
      calls.unwrap += 1;
      const dek = store.get(handle);
      if (!dek) throw new Error(`알 수 없는 DEK: ${handle}`);
      return Buffer.from(dek);
    },
  };

  return { provider, calls };
};

describe('EncryptionService', () => {
  it('암호화한 값을 그대로 복호화한다', async () => {
    const { provider } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    const plaintext = 'refresh-token-example-value';
    const envelope = await service.encrypt(plaintext);

    expect(await service.decrypt(envelope)).toBe(plaintext);
  });

  it('암호문에 평문이 남지 않는다', async () => {
    const { provider } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    const envelope = await service.encrypt('secret-token-value');

    expect(envelope).not.toContain('secret-token-value');
  });

  it('같은 평문도 매번 다른 암호문이 된다', async () => {
    const { provider } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    const a = await service.encrypt('same');
    const b = await service.encrypt('same');

    expect(a).not.toBe(b);
    expect(await service.decrypt(a)).toBe('same');
    expect(await service.decrypt(b)).toBe('same');
  });

  it('버전과 5개 필드로 구성된 형식을 따른다', async () => {
    const { provider } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    const parts = (await service.encrypt('x')).split(':');

    expect(parts).toHaveLength(5);
    expect(parts[0]).toBe('v1');
  });

  it('변조된 암호문은 복호화에 실패한다 (GCM 인증 태그)', async () => {
    const { provider } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    const parts = (await service.encrypt('원본')).split(':');
    parts[4] = randomBytes(16).toString('base64');

    await expect(service.decrypt(parts.join(':'))).rejects.toThrow();
  });

  it('형식이 어긋나면 거부한다', async () => {
    const { provider } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    await expect(service.decrypt('not-an-envelope')).rejects.toThrow(
      '암호문 형식이 올바르지 않다',
    );
    await expect(service.decrypt('v2:a:b:c:d')).rejects.toThrow(
      '암호문 형식이 올바르지 않다',
    );
  });

  it('DEK를 캐시해 매 암호화마다 감싸지 않는다', async () => {
    const { provider, calls } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    await service.encrypt('a');
    await service.encrypt('b');
    await service.encrypt('c');

    expect(calls.wrap).toBe(1);
  });

  it('이전 DEK로 암호화된 값도 복호화한다 (지연 재암호화 대응)', async () => {
    const { provider } = fakeKeyProvider();
    const service = new EncryptionService(provider);

    const old = await service.encrypt('예전 토큰');

    service.clearKeyCache();
    await service.encrypt('새 토큰');

    expect(await service.decrypt(old)).toBe('예전 토큰');
  });
});
