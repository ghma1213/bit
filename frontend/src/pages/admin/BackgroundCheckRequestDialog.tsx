import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/api/client'
import { adminApi } from '@/api/endpoints'
import type { BackgroundCheckCreated, EmployeeDetail } from '@/api/types'
import { Field } from '@/components/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { makeBackgroundCheckRequestSchema, type BackgroundCheckRequestValues } from '@/lib/schemas'
import { bcKeys } from './backgroundCheck'

/**
 * 새 배경조회 요청. 외부 서비스로 개인정보가 전송되므로 무엇이 나가는지 보여주고 확인받는다.
 * - 성/이름: 서버가 규칙으로 나눈 제안값을 관리자가 확인·수정한다.
 * - 생년월일: 등록된 값이 없을 때만 입력받고(YYYY-MM-DD), 이번 요청에만 쓴다(저장하지 않음).
 * 요청은 재시도가 불가능(중복 생성 위험)하므로 진행 중에는 버튼과 닫기를 모두 막는다.
 */
export function BackgroundCheckRequestDialog({
  employee,
  open,
  onOpenChange,
  onCreated,
}: {
  employee: EmployeeDetail
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (created: BackgroundCheckCreated) => void
}) {
  const queryClient = useQueryClient()

  const preview = useQuery({
    queryKey: bcKeys.preview(employee.id),
    queryFn: () => adminApi.backgroundChecks.preview(employee.id),
    enabled: open,
    gcTime: 0,
    staleTime: 0,
  })
  const registeredBirthDate = preview.data?.dateOfBirth ?? null
  const needsBirthDate = !!preview.data && !registeredBirthDate

  const registeredName = preview.data?.name ?? ''
  const schema = useMemo(
    () => makeBackgroundCheckRequestSchema(needsBirthDate, registeredName),
    [needsBirthDate, registeredName],
  )
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BackgroundCheckRequestValues>({
    resolver: zodResolver(schema),
    // 제안값이 도착하면 폼이 그 값으로 채워진다
    values: preview.data
      ? { lastName: preview.data.lastName, firstName: preview.data.firstName, dateOfBirth: '' }
      : undefined,
  })

  const mutation = useMutation({
    mutationFn: (v: BackgroundCheckRequestValues) =>
      adminApi.backgroundChecks.request(employee.id, {
        lastName: v.lastName,
        firstName: v.firstName,
        ...(needsBirthDate ? { dateOfBirth: v.dateOfBirth } : {}),
      }),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: bcKeys.list(employee.id) })
      mutation.reset()
      onCreated(created)
    },
  })

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return
    if (!next) {
      mutation.reset()
      reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>배경조회 요청</DialogTitle>
          <DialogDescription>
            {employee.name} ({employee.employeeNumber}) 님의 배경조회를 외부 서비스에 요청합니다.
          </DialogDescription>
        </DialogHeader>

        {preview.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : preview.error ? (
          <Alert variant="destructive" role="alert">
            <AlertDescription className="flex items-center justify-between gap-3">
              {errorMessage(preview.error)}
              <Button size="sm" variant="outline" onClick={() => void preview.refetch()}>
                다시 시도
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <form
            id="background-check-request-form"
            onSubmit={handleSubmit((v) => mutation.mutate(v))}
            noValidate
            className="flex flex-col gap-4"
          >
            <p className="text-sm text-muted-foreground">
              다음 정보가 외부 배경조회 서비스로 전송됩니다. 등록된 이름 <strong>{preview.data.name}</strong>을(를)
              자동으로 나눈 값입니다. 나누는 위치가 맞는지 확인하세요. 성과 이름을 합친 값은 등록된 이름과
              같아야 합니다.
            </p>

            <div className="flex gap-3">
              <div className="flex-1">
                <Field id="bc-lastName" label="성" error={errors.lastName?.message}>
                  <Input
                    id="bc-lastName"
                    autoComplete="off"
                    aria-invalid={!!errors.lastName}
                    aria-describedby={errors.lastName ? 'bc-lastName-error' : undefined}
                    {...register('lastName')}
                  />
                </Field>
              </div>
              <div className="flex-1">
                <Field id="bc-firstName" label="이름" error={errors.firstName?.message}>
                  <Input
                    id="bc-firstName"
                    autoComplete="off"
                    aria-invalid={!!errors.firstName}
                    aria-describedby={errors.firstName ? 'bc-firstName-error' : undefined}
                    {...register('firstName')}
                  />
                </Field>
              </div>
            </div>

            {registeredBirthDate ? (
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">생년월일</span>
                <span className="text-sm">{registeredBirthDate}</span>
                <span className="text-xs text-muted-foreground">등록된 값을 사용합니다.</span>
              </div>
            ) : (
              <Field
                id="bc-dateOfBirth"
                label="생년월일"
                error={errors.dateOfBirth?.message}
                hint="등록된 생년월일이 없어 입력이 필요합니다. 이번 요청에만 사용되며 직원 정보에는 저장되지 않습니다."
              >
                <Input
                  id="bc-dateOfBirth"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="YYYY-MM-DD"
                  maxLength={10}
                  aria-invalid={!!errors.dateOfBirth}
                  aria-describedby={errors.dateOfBirth ? 'bc-dateOfBirth-error' : undefined}
                  {...register('dateOfBirth')}
                />
              </Field>
            )}

            <p className="text-xs text-muted-foreground">
              사번 {preview.data.employeeNumber} 와 함께 전송됩니다. 요청과 결과 조회는 감사 로그에 기록되며, 요청은
              취소할 수 없습니다.
            </p>
          </form>
        )}

        {mutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(mutation.error)}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={mutation.isPending}>
            취소
          </Button>
          <Button
            type="submit"
            form="background-check-request-form"
            disabled={!preview.data || mutation.isPending}
          >
            {mutation.isPending ? '요청 중…' : '요청'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
