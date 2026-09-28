import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ApiError, errorMessage } from '@/api/client'
import { adminApi } from '@/api/endpoints'
import type { EmployeeDetail } from '@/api/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDateTime } from '@/lib/format'
import { useElapsedSeconds } from '@/lib/useElapsedSeconds'
import { BackgroundCheckBadge } from './BackgroundCheckBadge'
import { BackgroundCheckRequestDialog } from './BackgroundCheckRequestDialog'
import { BackgroundCheckResultDialog } from './BackgroundCheckResultDialog'
import { bcKeys } from './backgroundCheck'

// MEASUREMENTS.md 실측 근거: 완료까지 최소 30초 이상 걸렸고(§4), estimatedCompletionSeconds 는
// 항상 null 이었다(§6) — 그래서 그 값에 기대지 않고 고정 주기를 쓴다.
/** 최초 상태 확인까지 기다리는 시간 (생성 직후 조회해도 어차피 완료돼 있지 않다) */
const FIRST_POLL_DELAY_MS = 15_000
/** 이후 폴링 간격 — 매 폴링 "응답이 끝난 뒤" 이 시간만큼 대기한다(react-query 의 refetchInterval 은
 *  진행 중인 요청이 끝난 시점부터 다음 간격을 센다) */
const POLL_INTERVAL_MS = 10_000
/** 조회 생성 후 이 시간이 지나도 끝나지 않으면 폴링을 멈추고 수동 확인을 안내한다 */
const MAX_WAIT_MS = 3 * 60_000

/**
 * 다시 불러도 결과가 같은 오류 — 요청 자체를 고쳐야 하므로 폴링을 멈춘다.
 * 4xx(429 제외)와 외부 API 인증 실패(502 + UPSTREAM_AUTH_FAILED). 그 밖의 5xx 는 서버가 이미
 * 정해진 횟수만큼 재시도한 뒤 그 한 번의 조회만 실패한 것이라, 다음 주기에 다시 확인한다.
 */
const isFatalError = (e: unknown) =>
  e instanceof ApiError &&
  ((e.status >= 400 && e.status < 500 && e.status !== 429) || e.code === 'UPSTREAM_AUTH_FAILED')

/**
 * 진행 중(pending)인 조회 하나의 상태만 폴링한다. 끝나면 이력 목록을 새로 고친다.
 * 결과 상세는 관리자가 "결과 보기"를 열 때만 조회한다.
 * 화면을 떠나면(언마운트) 폴링도 멈춘다. 다시 오면 이력에서 이어서 확인한다.
 * 15초/3분은 조회 생성 시각(createdAt) 기준이라 화면을 나갔다 와도 처음부터 다시 세지 않는다.
 */
function PendingWatcher({ employeeId, checkId, createdAt }: { employeeId: string; checkId: string; createdAt: string }) {
  const queryClient = useQueryClient()
  // createdAt 은 외부 서버 시계라 브라우저 시계와 어긋난 만큼 오차가 생긴다(미래 시각은 지금으로 자른다).
  const [startedAt] = useState(() => {
    const t = Date.parse(createdAt)
    return Number.isNaN(t) ? Date.now() : Math.min(t, Date.now())
  })
  const [armed, setArmed] = useState(false) // 최초 폴링 전(생성 후 15초 대기)인지
  const [timedOut, setTimedOut] = useState(() => Date.now() - startedAt >= MAX_WAIT_MS)

  useEffect(() => {
    const t = setTimeout(() => setArmed(true), Math.max(0, startedAt + FIRST_POLL_DELAY_MS - Date.now()))
    return () => clearTimeout(t)
  }, [startedAt])

  const { data, error } = useQuery({
    // 상태 전용 조회: 민감 결과는 브라우저로 내려오지 않고 감사 로그도 남지 않는다
    queryKey: bcKeys.status(employeeId, checkId),
    queryFn: () => adminApi.backgroundChecks.status(employeeId, checkId),
    enabled: armed && !timedOut, // 3분이 지나면 폴링 종료
    gcTime: 0,
    refetchInterval: (query) => {
      if (query.state.data && query.state.data.status !== 'pending') return false
      if (isFatalError(query.state.error)) return false
      return POLL_INTERVAL_MS
    },
  })
  const fatal = isFatalError(error)

  const settled = !!data && data.status !== 'pending'
  useEffect(() => {
    if (settled) void queryClient.invalidateQueries({ queryKey: bcKeys.list(employeeId) })
  }, [settled, queryClient, employeeId])

  useEffect(() => {
    if (settled) return
    const t = setTimeout(() => setTimedOut(true), Math.max(0, startedAt + MAX_WAIT_MS - Date.now()))
    return () => clearTimeout(t)
  }, [settled, startedAt])

  if (fatal) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription>진행 상태를 확인할 수 없어 자동 확인을 멈췄습니다. {errorMessage(error)}</AlertDescription>
      </Alert>
    )
  }

  return (
    <p role="status" className="text-sm text-muted-foreground">
      {timedOut
        ? '조회가 예상보다 오래 걸리고 있습니다. 잠시 후 "새로고침"으로 확인하세요.'
        : '조회 결과를 기다리는 중입니다… 완료되면 자동으로 갱신됩니다.'}
    </p>
  )
}

export function BackgroundCheckSection({ employee }: { employee: EmployeeDetail }) {
  const [requestOpen, setRequestOpen] = useState(false)
  const [viewing, setViewing] = useState<string | null>(null)

  const list = useQuery({
    queryKey: bcKeys.list(employee.id),
    queryFn: () => adminApi.backgroundChecks.list(employee.id),
    gcTime: 0,
  })

  const pending = list.data?.items.find((i) => i.status === 'pending')
  // 초기 로딩 중의 경과 시간 표시용 (실측: 이 API 는 p50 0.3초지만 p95/p99 는 거의 30초라,
  // 정적인 스피너만 두면 멈춘 것처럼 보인다 — 몇 초째인지 보여준다)
  const initialLoadSeconds = useElapsedSeconds(list.isPending)
  // 데이터가 이미 있는 상태에서의 재조회(새로고침, 요청 직후 자동 갱신 등)
  const isRefetching = list.isFetching && !list.isPending

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">배경조회</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void list.refetch()} disabled={list.isFetching}>
            {isRefetching && <Loader2 className="animate-spin" />}
            새로고침
          </Button>
          {/* preview 는 이력 목록과 무관하게 즉시 열리므로, 이력 목록이 느려도(실제 API는 수초~30초) 버튼을 막지 않는다.
              이미 진행 중인 조회가 있다고 "확인된" 경우에만 막는다. 확인 전에 요청하면 서버가 409 로 막는다. */}
          <Button size="sm" onClick={() => setRequestOpen(true)} disabled={!!pending}>
            새 조회 요청
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {pending && (
          <PendingWatcher
            key={pending.checkId}
            employeeId={employee.id}
            checkId={pending.checkId}
            createdAt={pending.createdAt}
          />
        )}

        {list.isPending ? (
          <div
            className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-10 text-sm text-muted-foreground"
            role="status"
            aria-busy="true"
          >
            <Loader2 className="size-5 animate-spin" />
            <span>
              배경조회 이력을 불러오는 중… {initialLoadSeconds}초
              {initialLoadSeconds >= 10 && ' (이 API는 응답이 느릴 수 있습니다)'}
            </span>
          </div>
        ) : list.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex items-center justify-between gap-3">
              {errorMessage(list.error)}
              <Button size="sm" variant="outline" onClick={() => void list.refetch()}>
                다시 시도
              </Button>
            </AlertDescription>
          </Alert>
        ) : list.data.items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">조회 이력이 없습니다.</p>
        ) : (
          <div className="relative">
            {isRefetching && (
              <div
                className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-lg bg-background/70 text-sm text-muted-foreground"
                role="status"
              >
                <Loader2 className="size-4 animate-spin" />
                갱신 중…
              </div>
            )}
            <Table className={isRefetching ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
              <TableHeader>
                <TableRow>
                  <TableHead>요청 일시</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>완료 일시</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.items.map((c) => (
                  <TableRow key={c.checkId}>
                    <TableCell>{formatDateTime(c.createdAt)}</TableCell>
                    <TableCell>
                      <BackgroundCheckBadge status={c.status} />
                    </TableCell>
                    <TableCell>{formatDateTime(c.completedAt)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={c.status === 'pending'}
                        onClick={() => setViewing(c.checkId)}
                      >
                        결과 보기
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <BackgroundCheckRequestDialog
        employee={employee}
        open={requestOpen}
        onOpenChange={setRequestOpen}
        onCreated={() => setRequestOpen(false)}
      />
      {viewing && (
        <BackgroundCheckResultDialog employeeId={employee.id} checkId={viewing} onClose={() => setViewing(null)} />
      )}
    </Card>
  )
}
