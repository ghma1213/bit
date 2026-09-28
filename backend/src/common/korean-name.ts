/**
 * 외부 API(배경조회)가 lastName/firstName 을 요구하므로, 요청 시점에만 한글 이름을 나눈다.
 * DB 에는 name 하나로 저장한다.
 *  1) 공백이 있으면 첫 공백 기준 ("시스템 관리자" → 시스템 | 관리자)
 *  2) 3글자 이상이고 앞 2글자가 복성이면 복성 ("남궁서준" → 남궁 | 서준)
 *  3) 그 외에는 첫 글자가 성
 * 한계: 복성 후보로 시작하는 3글자 이름은 모호하다 ("선우진" = 선우|진 vs 선|우진).
 */
export const COMPOUND_SURNAMES: readonly string[] = [
  '남궁',
  '독고',
  '동방',
  '망절',
  '사공',
  '서문',
  '선우',
  '소봉',
  '어금',
  '장곡',
  '제갈',
  '황보',
];

export function splitKoreanName(fullName: string): {
  lastName: string;
  firstName: string;
} {
  const name = fullName.trim();
  const space = name.indexOf(' ');
  if (space > 0) {
    return {
      lastName: name.slice(0, space),
      firstName: name.slice(space + 1).trim(),
    };
  }
  const chars = [...name]; // 코드포인트 단위
  const surnameLength =
    chars.length >= 3 && COMPOUND_SURNAMES.includes(chars.slice(0, 2).join(''))
      ? 2
      : 1;
  return {
    lastName: chars.slice(0, surnameLength).join(''),
    firstName: chars.slice(surnameLength).join(''),
  };
}

const normalizeName = (s: string) => s.normalize('NFC').replace(/\s+/g, '');

/**
 * 관리자가 수정한 성/이름이 등록된 이름과 같은 사람을 가리키는지 검사한다.
 * 공백과 유니코드 정규화 차이는 무시한다 (나누는 위치만 바꿀 수 있고 글자는 바꿀 수 없다).
 */
export function isSameName(
  fullName: string,
  lastName: string,
  firstName: string,
): boolean {
  return (
    normalizeName(lastName) + normalizeName(firstName) ===
    normalizeName(fullName)
  );
}
