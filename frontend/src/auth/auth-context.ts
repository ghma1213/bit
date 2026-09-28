import { createContext, useContext } from 'react'
import type { AuthUser } from '@/api/types'

export interface AuthContextValue {
  /** 로그인한 사용자. 비로그인이면 null */
  user: AuthUser | null
  /** 최초 로그인 상태 확인 중 */
  isLoading: boolean
  /** 로그인 상태 확인 자체가 실패(서버 다운 등) */
  isError: boolean
  retry: () => void
  login: (employeeNumber: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
  /** 서버 상태(mustChangePassword 등)를 다시 읽는다 */
  refresh: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.')
  return ctx
}

/** 로그인 직후/홈에서 이동할 기본 경로 */
export function homeFor(user: AuthUser): string {
  if (user.mustChangePassword) return '/change-password'
  return user.role === 'ADMIN' ? '/admin/employees' : '/me'
}
