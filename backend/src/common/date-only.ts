/**
 * 생년월일처럼 "날짜만" 의미 있는 값은 시각이 붙은 ISO 문자열(1988-07-21T00:00:00.000Z)로 내리면
 * 클라이언트 시간대에 따라 하루 전 날짜로 보일 수 있다. YYYY-MM-DD 문자열로 고정한다.
 * (@db.Date 컬럼은 UTC 자정 Date 로 읽히므로 UTC 기준으로 자른다)
 */
export function withDateOnlyBirth<T extends { birthDate: Date | null }>(
  row: T,
): Omit<T, 'birthDate'> & { birthDate: string | null } {
  return {
    ...row,
    birthDate: row.birthDate ? row.birthDate.toISOString().slice(0, 10) : null,
  };
}
