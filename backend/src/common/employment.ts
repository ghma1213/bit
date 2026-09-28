import type { Prisma } from '../generated/prisma/client';

/**
 * DECISIONS.md #1: 퇴사 효력 시각(terminatedAt)이 지난 순간부터 퇴사자다. 그 전에는 "퇴사 예정"인 재직자라
 * 로그인/세션이 그대로 유지된다. 재직 상태는 이 규칙 하나로만 판단하고 따로 저장하지 않는다
 * (저장하면 효력 시각이 지날 때 값을 바꿔 줄 배치가 필요하다).
 */
export type EmploymentStatus = 'ACTIVE' | 'TERMINATED';

export const isTerminated = (terminatedAt: Date | null, now = new Date()) =>
  terminatedAt !== null && terminatedAt <= now;

export const employmentWhere = (
  status: EmploymentStatus,
  now = new Date(),
): Prisma.EmployeeWhereInput =>
  status === 'TERMINATED'
    ? { terminatedAt: { lte: now } }
    : { OR: [{ terminatedAt: null }, { terminatedAt: { gt: now } }] };

export function withStatus<T extends { terminatedAt: Date | null }>(row: T) {
  const status: EmploymentStatus = isTerminated(row.terminatedAt)
    ? 'TERMINATED'
    : 'ACTIVE';
  return { ...row, status };
}

// 한국 단일 시간대 고정. 해외 지사가 생기면 직원/회사별 시간대가 필요하다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 퇴사일(YYYY-MM-DD)의 효력 시각: 그날 0시(KST)부터 접근 차단 */
export const effectiveAtKst = (date: string) =>
  new Date(`${date}T00:00:00+09:00`);

/** 오늘 날짜(KST, YYYY-MM-DD) */
export const todayKst = (now = new Date()) =>
  new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
