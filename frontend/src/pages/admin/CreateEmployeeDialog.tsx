import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/api/client'
import { adminApi } from '@/api/endpoints'
import type { CreateEmployeeResult } from '@/api/types'
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
import {
  createEmployeeSchema,
  type CreateEmployeeOutput,
  type CreateEmployeeValues,
} from '@/lib/schemas'

type FieldName = keyof CreateEmployeeValues

const FIELDS: { name: FieldName; label: string; type?: string; placeholder?: string; required?: boolean }[] = [
  { name: 'employeeNumber', label: '사번', placeholder: 'EMP-011', required: true },
  { name: 'name', label: '이름', required: true },
  { name: 'email', label: '이메일 (선택)', type: 'email' },
  { name: 'phone', label: '연락처 (선택)', type: 'tel', placeholder: '010-1234-5678' },
  { name: 'department', label: '부서 (선택)' },
  { name: 'position', label: '직책 (선택)' },
  { name: 'birthDate', label: '생년월일 (선택)', type: 'date' },
  { name: 'hiredAt', label: '입사일 (비우면 오늘)', type: 'date' },
]

export function CreateEmployeeDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: (result: CreateEmployeeResult) => void
}) {
  const queryClient = useQueryClient()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateEmployeeValues, unknown, CreateEmployeeOutput>({
    resolver: zodResolver(createEmployeeSchema),
    defaultValues: {
      employeeNumber: '',
      name: '',
      email: '',
      department: '',
      position: '',
      phone: '',
      birthDate: '',
      hiredAt: '',
    },
  })

  const mutation = useMutation({
    // 빈 입력은 서버로 보내지 않는다(선택 필드)
    mutationFn: (v: CreateEmployeeOutput) =>
      adminApi.create({
        employeeNumber: v.employeeNumber,
        name: v.name,
        email: v.email || undefined,
        department: v.department || undefined,
        position: v.position || undefined,
        phone: v.phone || undefined,
        birthDate: v.birthDate || undefined,
        hiredAt: v.hiredAt || undefined,
      }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'employees'] })
      reset()
      onCreated(result)
    },
  })

  function handleOpenChange(next: boolean) {
    if (mutation.isPending) return // 전송 중에는 닫지 않는다
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
          <DialogTitle>직원 등록</DialogTitle>
          <DialogDescription>
            비밀번호는 서버가 임시 비밀번호로 생성합니다. 직원은 첫 로그인 때 변경해야 합니다.
          </DialogDescription>
        </DialogHeader>
        <form
          id="create-employee-form"
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
              <Field key={f.name} id={`create-${f.name}`} label={f.label} error={errors[f.name]?.message}>
                <Input
                  id={`create-${f.name}`}
                  type={f.type}
                  placeholder={f.placeholder}
                  aria-required={f.required}
                  aria-invalid={!!errors[f.name]}
                  aria-describedby={errors[f.name] ? `create-${f.name}-error` : undefined}
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
          <Button type="submit" form="create-employee-form" disabled={mutation.isPending}>
            {mutation.isPending ? '등록 중…' : '등록'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
