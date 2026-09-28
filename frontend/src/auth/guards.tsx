import type { ReactNode } from 'react'
import { Link, Navigate, Outlet } from 'react-router-dom'
import type { Role } from '@/api/types'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { homeFor, useAuth } from './auth-context'

// 주의: 이 가드들은 "화면 이동(UX)"을 위한 것이다. 실제 접근 통제는 항상 서버가 한다.

function FullPageLoading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 p-6" aria-busy="true">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-24 w-full" />
    </div>
  )
}

/** 로그인이 필요한 라우트 묶음. 임시 비밀번호 상태면 비밀번호 변경 화면으로만 보낸다. */
export function RequireAuth({ allowPasswordChange = false }: { allowPasswordChange?: boolean }) {
  const { user, isLoading, isError, retry } = useAuth()

  if (isLoading) return <FullPageLoading />
  if (isError) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <p>서버에 연결할 수 없습니다.</p>
        <Button onClick={retry}>다시 시도</Button>
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.mustChangePassword && !allowPasswordChange) {
    return <Navigate to="/change-password" replace />
  }
  return <Outlet />
}

/** 특정 역할만 볼 수 있는 라우트 묶음 */
export function RequireRole({ role }: { role: Role }) {
  const { user } = useAuth()
  if (user?.role !== role) return <Forbidden />
  return <Outlet />
}

/** 로그인하지 않은 사람만 볼 수 있는 화면(로그인). 이미 로그인했으면 홈으로 보낸다. */
export function GuestOnly({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageLoading />
  if (user) return <Navigate to={homeFor(user)} replace />
  return <>{children}</>
}

export function HomeRedirect() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <FullPageLoading />
  return <Navigate to={user ? homeFor(user) : '/login'} replace />
}

export function Forbidden() {
  const { user } = useAuth()
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-center">
      <h1 className="text-xl font-semibold">접근 권한이 없습니다</h1>
      <p className="text-muted-foreground">이 화면은 관리자만 사용할 수 있습니다.</p>
      {user && (
        <Button render={<Link to={homeFor(user)} />} variant="outline">
          홈으로
        </Button>
      )}
    </div>
  )
}
