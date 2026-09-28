const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

/** 인증이 필요한 API 가 401 을 반환했을 때(세션 만료/퇴사 처리 등) 발생시키는 이벤트 */
export const AUTH_EXPIRED_EVENT = 'auth:expired'

export class ApiError extends Error {
  status: number
  /** 서버가 내려주는 기계 판독용 코드 (예: PASSWORD_CHANGE_REQUIRED) */
  code?: string
  constructor(status: number, message: string, code?: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    ...init,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init.headers },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    // class-validator 는 message 를 문자열 배열로 내려준다
    const message = Array.isArray(body?.message)
      ? body.message.join('\n')
      : (body?.message ?? res.statusText)

    // 로그인/로그아웃/me 이외의 요청이 401 이면 세션이 끝난 것 → 앱 전체에 알린다
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
    }
    throw new ApiError(res.status, message, body?.code)
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T)
}

/** 사용자에게 보여줄 에러 문구 */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
    return e.message
  }
  if (e instanceof TypeError) return '서버에 연결할 수 없습니다. 네트워크를 확인해 주세요.'
  return '알 수 없는 오류가 발생했습니다.'
}
