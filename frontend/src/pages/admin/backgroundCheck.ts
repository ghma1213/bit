import type { BackgroundCheckResult, BackgroundCheckStatus } from '@/api/types'

export const STATUS_LABEL: Record<BackgroundCheckStatus, string> = {
  pending: '진행 중',
  clear: '이상 없음',
  flagged: '검토 필요',
}

export const CREDIT_LABEL: Record<NonNullable<BackgroundCheckResult['creditScore']>, string> = {
  excellent: '매우 좋음',
  good: '좋음',
  fair: '보통',
  poor: '나쁨',
}

/** 결과 조회/폴링 query key. 민감정보이므로 화면을 떠나면 캐시에서 바로 제거한다(gcTime: 0). */
export const bcKeys = {
  preview: (employeeId: string) => ['admin', 'employees', 'background-checks', employeeId, 'preview'] as const,
  list: (employeeId: string) => ['admin', 'employees', 'background-checks', employeeId, 'list'] as const,
  status: (employeeId: string, checkId: string) =>
    ['admin', 'employees', 'background-checks', employeeId, 'status', checkId] as const,
  detail: (employeeId: string, checkId: string) =>
    ['admin', 'employees', 'background-checks', employeeId, 'detail', checkId] as const,
}
