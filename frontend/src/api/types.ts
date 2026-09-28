export type Role = 'ADMIN' | 'EMPLOYEE'

/** GET /api/auth/me, POST /api/auth/login 응답 */
export interface AuthUser {
  id: string
  employeeNumber: string
  email: string | null
  name: string
  role: Role
  mustChangePassword: boolean
}

/** GET/PATCH /api/me 응답. birthDate 는 시각 없는 YYYY-MM-DD 문자열 */
export interface Profile {
  id: string
  employeeNumber: string
  email: string | null
  name: string
  role: Role
  phone: string | null
  address: string | null
  birthDate: string | null
  department: string | null
  position: string | null
  hiredAt: string
}

export type EmploymentStatus = 'ACTIVE' | 'TERMINATED'

/** GET /api/admin/employees 의 항목 */
export interface EmployeeListItem {
  id: string
  employeeNumber: string
  email: string | null
  name: string
  role: Role
  status: EmploymentStatus
  department: string | null
  position: string | null
  hiredAt: string
  terminatedAt: string | null
}

/** GET /api/admin/employees/:id */
export interface EmployeeDetail extends EmployeeListItem {
  phone: string | null
  address: string | null
  birthDate: string | null
  createdAt: string
  /** true 면 임시 비밀번호를 아직 변경하지 않은 상태 */
  mustChangePassword: boolean
  lockedUntil: string | null
}

export interface EmployeeList {
  items: EmployeeListItem[]
  total: number
  page: number
  pageSize: number
}

export interface CreateEmployeeInput {
  employeeNumber: string
  name: string
  email?: string
  department?: string
  position?: string
  phone?: string
  birthDate?: string
  hiredAt?: string
}

/** 임시 비밀번호는 이 응답에서 단 한 번만 내려온다 */
export interface CreateEmployeeResult {
  employee: EmployeeDetail
  temporaryPassword: string
}

/** PATCH /api/admin/employees/:id. 사번/역할/비밀번호는 이 API로 바꿀 수 없다.
 *  필드 생략: 변경 없음 / null: 값 삭제(name 제외 — 이름은 지울 수 없음) */
export interface UpdateEmployeeInput {
  name?: string
  email?: string | null
  department?: string | null
  position?: string | null
  phone?: string | null
  address?: string | null
  birthDate?: string | null
}

export type BackgroundCheckStatus = 'pending' | 'clear' | 'flagged'

/** GET /api/admin/employees/:id/background-checks 의 항목 (상태만) */
export interface BackgroundCheckItem {
  checkId: string
  status: BackgroundCheckStatus
  createdAt: string
  completedAt: string | null
}

export interface BackgroundCheckList {
  items: BackgroundCheckItem[]
  totalCount: number
}

export interface BackgroundCheckCreated {
  checkId: string
  status: BackgroundCheckStatus
  createdAt: string
  estimatedCompletionSeconds: number | null
}

/** 민감정보(범죄 이력, 신용 등급 등). 완료 전에는 세부 값이 null */
export interface BackgroundCheckResult {
  checkId: string
  status: BackgroundCheckStatus
  criminalRecord: boolean | null
  educationVerified: boolean | null
  employmentVerified: boolean | null
  creditScore: 'excellent' | 'good' | 'fair' | 'poor' | null
  createdAt: string
  completedAt: string | null
}

/** GET .../background-checks/preview — 요청 모달에 채울 값 (성/이름은 서버가 규칙으로 나눈 제안값) */
export interface BackgroundCheckPreview {
  employeeNumber: string
  name: string
  lastName: string
  firstName: string
  /** 등록된 생년월일(YYYY-MM-DD). 없으면 null */
  dateOfBirth: string | null
}

/** 관리자가 확인·수정한 외부 전송 값 */
export interface BackgroundCheckRequestInput {
  lastName: string
  firstName: string
  /** 직원 정보에 생년월일이 없을 때만. 이번 요청에만 쓰이고 저장되지 않는다 */
  dateOfBirth?: string
}

/** 폴링용 상태 조회 응답 — 민감 필드(범죄 이력 등)는 포함되지 않는다 */
export interface BackgroundCheckStatusResponse {
  checkId: string
  status: BackgroundCheckStatus
  completedAt: string | null
}
