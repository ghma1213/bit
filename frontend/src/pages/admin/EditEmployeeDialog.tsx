import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/api/client'
import { adminApi } from '@/api/endpoints'
import type { EmployeeDetail } from '@/api/types'
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
import { updateEmployeeSchema, type UpdateEmployeeOutput, type UpdateEmployeeValues } from '@/lib/schemas'

type FieldName = keyof UpdateEmployeeValues

const FIELDS: { name: FieldName; label: string; type?: string; placeholder?: string; required?: boolean }[] = [
  { name: 'name', label: '이름', required: true },
  { name: 'email', label: '이메일 (선택)', type: 'email' },
  { name: 'phone', label: '연락처 (선택)', type: 'tel', placeholder: '010-1234-5678' },
  { name: 'department', label: '부서 (선택)' },
  { name: 'position', label: '직책 (선택)' },
  { name: 'address', label: '주소 (선택)' },
  { name: 'birthDate', label: '생년월일 (선택)', type: 'date' },
]

export function EditEmployeeDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateEmployeeValues, unknown, UpdateEmployeeOutput>({
    resolver: zodResolver(updateEmployeeSchema),
    values: {
      name: employee.name,
      email: employee.email ?? '',
      department: employee.department ?? '',
      position: employee.position ?? '',
      phone: employee.phone ?? '',
      address: employee.address ?? '',
      birthDate: employee.birthDate ?? '',
    },
  })

  const mutation = useMutation({
    // 빈 문자열은 "값 삭제"(null)로 보낸다 — 생성 폼과 달리 여기선 undefined(변경 없음)가 아니다
    mutationFn: (v: UpdateEmployeeOutput) =>
      adminApi.update(employee.id, {
        name: v.name,
        email: v.email || null,
        department: v.department || null,
        position: v.position || null,
        phone: v.phone || null,
        address: v.address || null,
        birthDate: v.birthDate || null,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] })
      onOpenChange(false)
    },
  })

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return
    if (!next) {
      reset()
      mutation.reset()
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>직원 정보 수정</DialogTitle>
          <DialogDescription>
            사번과 권한(관리자/직원)은 이 화면에서 바꿀 수 없습니다. 필드를 비우면 값이 삭제됩니다.
          </DialogDescription>
        </DialogHeader>
        <form
          id="edit-employee-form"
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          noValidate
          className="flex flex-col gap-4"
        >
          {mutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(mutation.error)}</AlertDescription>
            </Alert>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.name} id={`edit-${f.name}`} label={f.label} error={errors[f.name]?.message}>
                <Input
                  id={`edit-${f.name}`}
                  type={f.type}
                  placeholder={f.placeholder}
                  aria-required={f.required}
                  aria-invalid={!!errors[f.name]}
                  aria-describedby={errors[f.name] ? `edit-${f.name}-error` : undefined}
                  {...register(f.name)}
                />
              </Field>
            ))}
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={mutation.isPending}>
            취소
          </Button>
          <Button type="submit" form="edit-employee-form" disabled={mutation.isPending}>
            {mutation.isPending ? '저장 중…' : '저장'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
