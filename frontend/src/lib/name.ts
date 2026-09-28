const normalizeName = (s: string) => s.normalize('NFC').replace(/\s+/g, '')

/**
 * 수정한 성/이름이 등록된 이름과 같은 사람을 가리키는지 검사한다 (나누는 위치만 바꿀 수 있다).
 * 서버(backend/src/common/korean-name.ts)와 같은 규칙이다. 최종 검증은 항상 서버가 한다.
 */
export function isSameName(fullName: string, lastName: string, firstName: string): boolean {
  return normalizeName(lastName) + normalizeName(firstName) === normalizeName(fullName)
}
