import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { ApiError, AUTH_EXPIRED_EVENT } from '@/api/client'
import { authApi } from '@/api/endpoints'
import type { AuthUser } from '@/api/types'
import { AuthContext, type AuthContextValue } from './auth-context'

const ME_KEY = ['auth', 'me'] as const

async function fetchMe(): Promise<AuthUser | null> {
  try {
    return await authApi.me()
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) return null // 비로그인은 에러가 아니라 정상 상태
    throw e
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const query = useQuery({ queryKey: ME_KEY, queryFn: fetchMe, staleTime: Infinity })

  /** 다른 사용자의 데이터가 다음 로그인에 보이지 않도록 인증 외 캐시를 모두 비운다 */
  const dropUserData = useCallback(() => {
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== 'auth' })
  }, [queryClient])

  // 세션 만료/퇴사 처리로 API 가 401 을 주면 로그아웃 상태로 전환 → 가드가 /login 으로 보낸다
  useEffect(() => {
    const onExpired = () => {
      dropUserData()
      queryClient.setQueryData(ME_KEY, null)
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [queryClient, dropUserData])

  const login = useCallback(
    async (employeeNumber: string, password: string) => {
      const user = await authApi.login(employeeNumber, password)
      dropUserData()
      queryClient.setQueryData(ME_KEY, user)
      return user
    },
    [queryClient, dropUserData],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      // 서버 호출이 실패해도 화면은 로그아웃 상태로 만든다
      dropUserData()
      queryClient.setQueryData(ME_KEY, null)
    }
  }, [queryClient, dropUserData])

  const refresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ME_KEY })
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: query.data ?? null,
      isLoading: query.isPending,
      isError: query.isError,
      retry: () => void query.refetch(),
      login,
      logout,
      refresh,
    }),
    [query, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
