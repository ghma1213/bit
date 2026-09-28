import { z } from 'zod'
import { isPastCalendarDate } from '@/lib/date'
import { isSameName } from '@/lib/name'

// 서버(백엔드 DTO)와 같은 규칙을 화면에서 먼저 검사한다. 최종 검증은 항상 서버가 한다.

export const loginSchema = z.object({
  employeeNumber: z.string().trim().min(1, '사번을 입력하세요.'),
  password: z.string().min(1, '비밀번호를 입력하세요.'),
})
export type LoginValues = z.infer<typeof loginSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, '현재 비밀번호를 입력하세요.'),
    newPassword: z
      .string()
      .min(12, '비밀번호는 12자 이상이어야 합니다.')
      .max(128, '비밀번호는 128자 이하여야 합니다.'),
    confirmPassword: z.string().min(1, '새 비밀번호를 한 번 더 입력하세요.'),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ['confirmPassword'],
    message: '새 비밀번호가 일치하지 않습니다.',
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    path: ['newPassword'],
    message: '현재 비밀번호와 달라야 합니다.',
  })
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>

export const profileSchema = z.object({
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+\-() ]{7,20}$/.test(v), '연락처 형식이 올바르지 않습니다.'),
  address: z.string().trim().max(200, '주소는 200자 이하여야 합니다.'),
})
export type ProfileValues = z.infer<typeof profileSchema>

const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === '' || /^\d{4}-\d{2}-\d{2}$/.test(v), '날짜는 YYYY-MM-DD 형식이어야 합니다.')

/** 계정 생성 폼. 비밀번호는 입력받지 않는다(서버가 임시 비밀번호를 생성). */
export const createEmployeeSchema = z.object({
  employeeNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{3,20}$/, '사번은 영문/숫자/하이픈 3~20자여야 합니다.'),
  name: z.string().trim().min(1, '이름을 입력하세요.').max(50, '이름은 50자 이하여야 합니다.'),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || z.email().safeParse(v).success, '이메일 형식이 올바르지 않습니다.'),
  department: z.string().trim().max(50, '50자 이하여야 합니다.'),
  position: z.string().trim().max(50, '50자 이하여야 합니다.'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+\-() ]{7,20}$/.test(v), '연락처 형식이 올바르지 않습니다.'),
  birthDate: optionalDate,
  hiredAt: optionalDate,
})
export type CreateEmployeeValues = z.input<typeof createEmployeeSchema>
export type CreateEmployeeOutput = z.output<typeof createEmployeeSchema>

/** 관리자가 기존 직원 정보를 수정하는 폼. 사번/역할/비밀번호는 없다(수정 불가).
 *  빈 문자열은 "값 삭제"로 취급한다(name 제외 — 이름은 비울 수 없음). */
export const updateEmployeeSchema = z.object({
  name: z.string().trim().min(1, '이름을 입력하세요.').max(50, '이름은 50자 이하여야 합니다.'),
  email: z
    .string()
    .trim()
    .max(254)
    .refine((v) => v === '' || z.email().safeParse(v).success, '이메일 형식이 올바르지 않습니다.'),
  department: z.string().trim().max(50, '50자 이하여야 합니다.'),
  position: z.string().trim().max(50, '50자 이하여야 합니다.'),
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || /^[0-9+\-() ]{7,20}$/.test(v), '연락처 형식이 올바르지 않습니다.'),
  address: z.string().trim().max(200, '200자 이하여야 합니다.'),
  birthDate: optionalDate,
})
export type UpdateEmployeeValues = z.input<typeof updateEmployeeSchema>
export type UpdateEmployeeOutput = z.output<typeof updateEmployeeSchema>

/**
 * 배경조회 요청 폼.
 * - 성/이름: 나누는 위치만 수정 가능 (성+이름이 등록된 이름과 같아야 한다)
 * - 생년월일: 직원 정보에 없을 때만 입력(YYYY-MM-DD 엄격 검사)
 */
export const makeBackgroundCheckRequestSchema = (needsBirthDate: boolean, registeredName: string) =>
  z
    .object({
      lastName: z.string().trim().min(1, '성을 입력하세요.').max(50, '50자 이하여야 합니다.'),
      firstName: z.string().trim().min(1, '이름을 입력하세요.').max(50, '50자 이하여야 합니다.'),
      dateOfBirth: z
        .string()
        .trim()
        .refine(
          (v) => !needsBirthDate || isPastCalendarDate(v),
          '생년월일은 실제 존재하는 과거 날짜를 YYYY-MM-DD 형식으로 입력하세요. (예: 1990-03-15)',
        ),
    })
    .refine((v) => isSameName(registeredName, v.lastName, v.firstName), {
      path: ['firstName'],
      message: `성과 이름을 합친 값이 등록된 이름(${registeredName})과 같아야 합니다.`,
    })
export type BackgroundCheckRequestValues = z.infer<ReturnType<typeof makeBackgroundCheckRequestSchema>>
