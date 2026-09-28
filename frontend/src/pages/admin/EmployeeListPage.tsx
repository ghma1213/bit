import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { adminApi } from '@/api/endpoints'
import type { CreateEmployeeResult, EmploymentStatus } from '@/api/types'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate } from '@/lib/format'
import { CreateEmployeeDialog } from './CreateEmployeeDialog'
import { TempPasswordDialog } from './TempPasswordDialog'

const PAGE_SIZE = 10

const STATUS_FILTERS: { label: string; value: EmploymentStatus | undefined }[] = [
  { label: '전체', value: undefined },
  { label: '재직', value: 'ACTIVE' },
  { label: '퇴사', value: 'TERMINATED' },
]

export function EmployeeListPage() {
  // 검색/필터/페이지는 URL 이 단일 출처: 새로고침·뒤로가기·링크 공유에도 유지된다.
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const q = params.get('q') ?? ''
  const statusParam = params.get('status')
  const status: EmploymentStatus | undefined =
    statusParam === 'ACTIVE' || statusParam === 'TERMINATED' ? statusParam : undefined
  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10) || 1)

  function update(patch: Record<string, string | undefined>) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v) next.set(k, v)
          else next.delete(k)
        }
        return next
      },
      { replace: true },
    )
  }

  // 입력은 로컬 state 로 즉시 반영하고, 300ms 멈추면 URL 에 반영한다.
  const [search, setSearch] = useState(q)
  useEffect(() => setSearch(q), [q])
  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== q) update({ q: search.trim() || undefined, page: undefined })
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const { data, isPending, error, refetch, isPlaceholderData } = useQuery({
    queryKey: ['admin', 'employees', 'list', { q, status, page }],
    queryFn: () => adminApi.list({ q: q || undefined, status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const [createOpen, setCreateOpen] = useState(false)
  const [created, setCreated] = useState<CreateEmployeeResult | null>(null)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">직원 관리</h1>
        <Button onClick={() => setCreateOpen(true)}>직원 등록</Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          type="search"
          aria-label="직원 검색"
          placeholder="사번, 이름, 이메일 검색"
          className="max-w-xs bg-background"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-1" role="group" aria-label="재직 상태 필터">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f.label}
              size="sm"
              variant={status === f.value ? 'default' : 'outline'}
              aria-pressed={status === f.value}
              onClick={() => update({ status: f.value, page: undefined })}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>

      {error && !data ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex items-center justify-between gap-4">
            {errorMessage(error)}
            <Button size="sm" variant="outline" onClick={() => void refetch()}>
              다시 시도
            </Button>
          </AlertDescription>
        </Alert>
      ) : isPending ? (
        <Skeleton className="h-64 w-full" aria-busy="true" />
      ) : (
        <Card className={isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>사번</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead>부서</TableHead>
                  <TableHead>직책</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead>입사일</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      {page > 1 && data.total > 0 ? (
                        <Button variant="outline" size="sm" onClick={() => update({ page: undefined })}>
                          첫 페이지로
                        </Button>
                      ) : (
                        '조건에 맞는 직원이 없습니다.'
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  data.items.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.employeeNumber}</TableCell>
                      <TableCell>
                        {/* 상세에서 목록으로 돌아올 때 검색 조건을 유지하도록 현재 쿼리를 넘긴다 */}
                        <Link
                          to={`/admin/employees/${e.id}`}
                          state={{ from: location.search }}
                          className="font-medium underline-offset-4 hover:underline"
                        >
                          {e.name}
                        </Link>
                      </TableCell>
                      <TableCell>{e.department ?? '-'}</TableCell>
                      <TableCell>{e.position ?? '-'}</TableCell>
                      <TableCell>
                        <StatusBadge status={e.status} terminatedAt={e.terminatedAt} />
                      </TableCell>
                      <TableCell>{formatDate(e.hiredAt)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground" role="status">
            총 {data.total}명 · {page} / {totalPages} 페이지
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => update({ page: page > 2 ? String(page - 1) : undefined })}
            >
              이전
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => update({ page: String(page + 1) })}
            >
              다음
            </Button>
          </div>
        </div>
      )}

      <CreateEmployeeDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(result) => {
          setCreateOpen(false)
          setCreated(result)
        }}
      />
      {created && (
        <TempPasswordDialog
          key={created.employee.id}
          result={created}
          onClose={() => setCreated(null)}
        />
      )}
    </div>
  )
}
