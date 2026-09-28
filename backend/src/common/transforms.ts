/** class-transformer 용: 문자열이면 앞뒤 공백 제거 */
export const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** 이메일 정규화: 공백 제거 + 소문자 (로그인이 소문자로 조회하므로 저장도 동일하게) */
export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

/** 사번 정규화: 공백 제거 + 대문자 (emp-001 → EMP-001) */
export const normalizeEmployeeNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
