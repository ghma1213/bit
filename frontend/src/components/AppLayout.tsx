import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/auth-context'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn('rounded-md px-2.5 py-1 text-sm', isActive ? 'bg-muted font-medium' : 'text-muted-foreground hover:text-foreground')

export function AppLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  async function onLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold">직원 관리</span>
            {/* 임시 비밀번호 상태에서는 다른 메뉴를 보여주지 않는다 */}
            {!user.mustChangePassword && (
              <nav className="flex gap-1" aria-label="주 메뉴">
                <NavLink to="/me" className={linkClass}>
                  내 정보
                </NavLink>
                {user.role === 'ADMIN' && (
                  <NavLink to="/admin/employees" className={linkClass}>
                    관리자
                  </NavLink>
                )}
                <NavLink to="/change-password" className={linkClass}>
                  비밀번호 변경
                </NavLink>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm">
              {user.name} <span className="text-muted-foreground">({user.employeeNumber})</span>
            </span>
            {user.role === 'ADMIN' && <Badge variant="secondary">관리자</Badge>}
            <Button variant="outline" size="sm" onClick={onLogout}>
              로그아웃
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
