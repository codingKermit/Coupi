import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';

import { SessionService } from './session.service';

const config = {
  getOrThrow: () => 'test-secret',
} as unknown as ConfigService;

const otherConfig = {
  getOrThrow: () => 'different-secret',
} as unknown as ConfigService;

describe('SessionService — 세션 토큰', () => {
  const service = new SessionService(config);

  it('발급한 토큰에서 사용자 id를 되찾는다', () => {
    const token = service.issueSession('user-1');
    expect(service.verifySession(token)).toBe('user-1');
  });

  it('다른 비밀키로 서명된 토큰은 거부한다', () => {
    const attacker = new SessionService(otherConfig);
    const forged = attacker.issueSession('user-1');

    expect(() => service.verifySession(forged)).toThrow(UnauthorizedException);
  });

  it('state 토큰을 세션으로 쓸 수 없다', () => {
    const state = service.issueState();
    expect(() => service.verifySession(state)).toThrow('세션 토큰이 아니다');
  });

  it('형식이 아닌 문자열은 거부한다', () => {
    expect(() => service.verifySession('garbage')).toThrow(
      UnauthorizedException,
    );
  });
});

describe('SessionService — state 토큰', () => {
  const service = new SessionService(config);

  it('발급한 state를 검증한다', () => {
    expect(() => service.verifyState(service.issueState())).not.toThrow();
  });

  it('매번 다른 값을 발급한다 (nonce)', () => {
    expect(service.issueState()).not.toBe(service.issueState());
  });

  it('세션 토큰을 state로 쓸 수 없다', () => {
    const session = service.issueSession('user-1');
    expect(() => service.verifyState(session)).toThrow('state 토큰이 아니다');
  });

  it('위조된 state는 거부한다', () => {
    const attacker = new SessionService(otherConfig);
    expect(() => service.verifyState(attacker.issueState())).toThrow(
      UnauthorizedException,
    );
  });
});
