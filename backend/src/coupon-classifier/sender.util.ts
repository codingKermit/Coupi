/**
 * 발신자 헤더에서 도메인을 뽑는다.
 *
 * Gmail의 From 헤더는 `쿠팡 <no-reply@coupang.com>` 또는 `no-reply@coupang.com` 형태다.
 */
export function extractSenderDomain(sender: string): string | null {
  const angle = sender.match(/<([^>]+)>/);
  const address = (angle ? angle[1] : sender).trim();

  const at = address.lastIndexOf('@');
  if (at === -1 || at === address.length - 1) return null;

  return address.slice(at + 1).toLowerCase();
}

/**
 * 화이트리스트 도메인과 일치하는지 본다. 서브도메인도 허용한다
 * (`mail.coupang.com`은 `coupang.com` 등록만으로 매칭된다).
 */
export function matchesDomain(
  senderDomain: string,
  whitelisted: string,
): boolean {
  const target = whitelisted.toLowerCase();
  return senderDomain === target || senderDomain.endsWith(`.${target}`);
}
