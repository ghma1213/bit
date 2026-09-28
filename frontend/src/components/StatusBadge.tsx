import type { EmploymentStatus } from '@/api/types'
import { Badge } from '@/components/ui/badge'

/** 재직 중인데 퇴사일(terminatedAt)이 있으면 "퇴사 예정"이다 (서버가 효력 시각 기준으로 status 를 계산한다) */
export function StatusBadge({ status, terminatedAt }: { status: EmploymentStatus; terminatedAt: string | null }) {
  if (status === 'TERMINATED') return <Badge variant="destructive">퇴사</Badge>
  if (terminatedAt) return <Badge variant="outline">퇴사 예정</Badge>
  return <Badge variant="secondary">재직</Badge>
}
