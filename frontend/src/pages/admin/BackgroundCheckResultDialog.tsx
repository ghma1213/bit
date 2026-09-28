import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { errorMessage } from '@/api/client'
import { adminApi } from '@/api/endpoints'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDateTime } from '@/lib/format'
import { BackgroundCheckBadge } from './BackgroundCheckBadge'
import { bcKeys, CREDIT_LABEL } from './backgroundCheck'

function Row({ label, value, warn }: { label: string; value: ReactNode; warn?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b py-2 last:border-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className={warn ? 'text-sm font-medium text-destructive' : 'text-sm font-medium'}>{value}</dd>
    </div>
  )
}

const yesNo = (v: boolean | null, yes: string, no: string) => (v === null ? '-' : v ? yes : no)

/**
 * 민감정보(범죄 이력, 신용 등급 등) 표시. 열 때마다 서버에서 새로 조회하고(감사 로그 기록),
 * 닫으면 캐시에서 즉시 제거한다(gcTime: 0).
 */
export function BackgroundCheckResultDialog({
  employeeId,
  checkId,
  onClose,
}: {
  employeeId: string
  checkId: string
  onClose: () => void
}) {
  const { data, isPending, error, refetch } = useQuery({
    queryKey: bcKeys.detail(employeeId, checkId),
    queryFn: () => adminApi.backgroundChecks.get(employeeId, checkId),
    gcTime: 0,
    staleTime: 0,
  })

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>배경조회 결과</DialogTitle>
          <DialogDescription>민감정보입니다. 이 화면을 여는 기록은 감사 로그에 남습니다.</DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex items-center justify-between gap-3">
              {errorMessage(error)}
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                다시 시도
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <dl>
            <Row label="종합 결과" value={<BackgroundCheckBadge status={data.status} />} />
            {data.status === 'pending' ? (
              <p className="py-3 text-sm text-muted-foreground">아직 조회가 진행 중입니다. 잠시 후 다시 확인하세요.</p>
            ) : (
              <>
                <Row label="범죄 이력" value={yesNo(data.criminalRecord, '있음', '없음')} warn={data.criminalRecord === true} />
                <Row label="학력 검증" value={yesNo(data.educationVerified, '확인됨', '확인 안 됨')} warn={data.educationVerified === false} />
                <Row label="경력 검증" value={yesNo(data.employmentVerified, '확인됨', '확인 안 됨')} warn={data.employmentVerified === false} />
                <Row label="신용 등급" value={data.creditScore ? CREDIT_LABEL[data.creditScore] : '-'} warn={data.creditScore === 'poor'} />
              </>
            )}
            <Row label="요청 일시" value={formatDateTime(data.createdAt)} />
            <Row label="완료 일시" value={formatDateTime(data.completedAt)} />
          </dl>
        )}

        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
