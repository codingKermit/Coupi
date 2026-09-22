/**
 * DEK(데이터 암호화 키)를 감싸고 푸는 주체. `docs/07-보안개인정보.md`의 envelope encryption.
 *
 * 운영에서는 Cloud KMS가, 로컬 개발에서는 환경변수 마스터 키가 이 역할을 한다.
 * 어느 쪽이든 평문 DEK가 DB에 저장되는 일은 없다.
 */
export interface KeyProvider {
  readonly name: string;
  /** 평문 DEK를 감싼 결과를 base64로 반환한다. */
  wrapDek(dek: Buffer): Promise<string>;
  /** 감싸진 DEK(base64)를 풀어 평문 DEK를 반환한다. */
  unwrapDek(wrapped: string): Promise<Buffer>;
}

export const KEY_PROVIDER = Symbol('KEY_PROVIDER');
