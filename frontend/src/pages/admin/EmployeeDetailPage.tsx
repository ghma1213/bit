import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiError, errorMessage } from '@/api/client'
import { adminApi } from '@/api/endpoints'
import { useAuth } from '@/auth/auth-context'
import { StatusBadge } from '@/components/StatusBadge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatDate, formatDateTime } from '@/lib/format'
import { BackgroundCheckSection } from './BackgroundCheckSection'
import { EditEmployeeDialog } from './EditEmployeeDialog'
import { TerminateDialog } from './TerminateDialog'

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

const dash = (v: string | null) => v || '-'

export function EmployeeDetailPage() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const location = useLocation()
  const [terminateOpen, setTerminateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  // 목록에서 넘어온 검색 조건을 되돌아갈 때 복원한다
  const from = (location.state as { from?: string } | null)?.from ?? ''
  const backTo = `/admin/employees${from}`

  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['admin', 'employees', 'detail', id],
    queryFn: () => adminApi.get(id),
  })

  const back = (
    <Button render={<Link to={backTo} />} variant="ghost" size="sm" className="w-fit">
      ← 직원 목록
    </Button>
  )

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        {back}
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (error) {
    // 존재하지 않는 id(404)나 형식이 잘못된 id(400)
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="flex flex-col gap-4">
        {back}
        <Alert variant="destructive" role="alert">
          <AlertDescription className="flex items-center justify-between gap-4">
            {notFound ? '직원을 찾을 수 없습니다.' : errorMessage(error)}
            {!notFound && (
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                다시 시도
              </Button>
            )}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  const isSelf = data.id === user?.id
  const locked = !!data.lockedUntil && new Date(data.lockedUntil) > new Date()

  return (
    <div className="flex flex-col gap-6">
      {back}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{data.name}</h1>
          <StatusBadge status={data.status} terminatedAt={data.terminatedAt} />
          {data.role === 'ADMIN' && <Badge variant="secondary">관리자</Badge>}
        </div>
        {data.status === 'ACTIVE' &&
          (isSelf ? (
            <p className="text-sm text-muted-foreground">본인 계정은 퇴사 처리할 수 없습니다.</p>
          ) : (
            <Button variant="destructive" onClick={() => setTerminateOpen(true)}>
              {data.terminatedAt ? '퇴사일 변경' : '퇴사 처리'}
            </Button>
          ))}
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">인적사항</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            정보 수정
          </Button>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Row label="사번" value={<span className="font-mono">{data.employeeNumber}</span>} />
            <Row label="이름" value={data.name} />
            <Row label="생년월일" value={dash(data.birthDate)} />
            <Row label="이메일" value={dash(data.email)} />
            <Row label="연락처" value={dash(data.phone)} />
            <Row label="주소" value={dash(data.address)} />
            <Row label="부서" value={dash(data.department)} />
            <Row label="직책" value={dash(data.position)} />
            <Row label="입사일" value={formatDate(data.hiredAt)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">계정 상태</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <Row label="재직 상태" value={<StatusBadge status={data.status} terminatedAt={data.terminatedAt} />} />
            <Row
              label="퇴사일"
              value={
                formatDate(data.terminatedAt) + (data.status === 'ACTIVE' && data.terminatedAt ? ' (예정)' : '')
              }
            />
            <Row label="계정 생성일" value={formatDateTime(data.createdAt)} />
            <Row
              label="비밀번호"
              value={data.mustChangePassword ? '임시 비밀번호 (변경 대기)' : '변경 완료'}
            />
            <Row
              label="로그인 잠금"
              value={locked ? `잠김 (${formatDateTime(data.lockedUntil)} 까지)` : '정상'}
            />
          </dl>
        </CardContent>
      </Card>

      <BackgroundCheckSection employee={data} />

      <TerminateDialog employee={data} open={terminateOpen} onOpenChange={setTerminateOpen} />
      <EditEmployeeDialog employee={data} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}
