import { api } from './client'
import type {
  AuthUser,
  BackgroundCheckCreated,
  BackgroundCheckList,
  BackgroundCheckPreview,
  BackgroundCheckRequestInput,
  BackgroundCheckResult,
  BackgroundCheckStatusResponse,
  CreateEmployeeInput,
  CreateEmployeeResult,
  EmployeeDetail,
  EmployeeList,
  EmploymentStatus,
  Profile,
  UpdateEmployeeInput,
} from './types'

export const authApi = {
  login: (employeeNumber: string, password: string) =>
    api<AuthUser>('/auth/login', { method: 'POST', body: JSON.stringify({ employeeNumber, password }) }),
  logout: () => api<void>('/auth/logout', { method: 'POST' }),
  me: () => api<AuthUser>('/auth/me'),
}

export const meApi = {
  get: () => api<Profile>('/me'),
  update: (body: { phone?: string | null; address?: string | null }) =>
    api<Profile>('/me', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<void>('/me/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }),
}

export interface ListEmployeesParams {
  q?: string
  status?: EmploymentStatus
  page: number
  pageSize: number
}

export const adminApi = {
  list: ({ q, status, page, pageSize }: ListEmployeesParams) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    if (q) params.set('q', q)
    if (status) params.set('status', status)
    return api<EmployeeList>(`/admin/employees?${params}`)
  },
  get: (id: string) => api<EmployeeDetail>(`/admin/employees/${encodeURIComponent(id)}`),
  create: (body: CreateEmployeeInput) =>
    api<CreateEmployeeResult>('/admin/employees', { method: 'POST', body: JSON.stringify(body) }),
  /** 사번/역할/비밀번호는 수정 대상이 아니다 */
  update: (id: string, body: UpdateEmployeeInput) =>
    api<EmployeeDetail>(`/admin/employees/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  /** effectiveDate(YYYY-MM-DD) 0시부터 접근 차단. 미래 날짜면 그때까지는 "퇴사 예정"인 재직자 */
  terminate: (id: string, effectiveDate: string) =>
    api<EmployeeDetail>(`/admin/employees/${encodeURIComponent(id)}/terminate`, {
      method: 'POST',
      body: JSON.stringify({ effectiveDate }),
    }),

  // 배경조회 (관리자 전용, 민감정보). 서버가 외부 API 를 중계한다.
  backgroundChecks: {
    list: (employeeId: string) =>
      api<BackgroundCheckList>(`/admin/employees/${encodeURIComponent(employeeId)}/background-checks`),
    preview: (employeeId: string) =>
      api<BackgroundCheckPreview>(
        `/admin/employees/${encodeURIComponent(employeeId)}/background-checks/preview`,
      ),
    request: (employeeId: string, body: BackgroundCheckRequestInput) =>
      api<BackgroundCheckCreated>(`/admin/employees/${encodeURIComponent(employeeId)}/background-checks`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    /** 폴링용: 상태와 완료 시각만 (민감 필드 없음, 감사 로그 없음) */
    status: (employeeId: string, checkId: string) =>
      api<BackgroundCheckStatusResponse>(
        `/admin/employees/${encodeURIComponent(employeeId)}/background-checks/${encodeURIComponent(checkId)}/status`,
      ),
    get: (employeeId: string, checkId: string) =>
      api<BackgroundCheckResult>(
        `/admin/employees/${encodeURIComponent(employeeId)}/background-checks/${encodeURIComponent(checkId)}`,
      ),
  },
}
