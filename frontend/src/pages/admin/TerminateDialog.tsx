import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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

/** 브라우저 기준 오늘 날짜(YYYY-MM-DD). 최종 판단은 서버(KST)가 한다. */
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * DECISIONS.md #1: 퇴사일 0시부터 접근이 차단된다. 오늘이면 즉시, 미래면 그날까지는 재직자로 남는다.
 * 효력이 나면 되돌릴 수 없으므로 대상 사번을 직접 입력해야 버튼이 활성화된다(다른 직원을 잘못 처리하는 사고 방지).
 */
export function TerminateDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const today = localToday()
  const [effectiveDate, setEffectiveDate] = useState(today)
  const matches = typed.trim().toUpperCase() === employee.employeeNumber
  const immediate = effectiveDate === today

  const mutation = useMutation({
    mutationFn: () => adminApi.terminate(employee.id, effectiveDate),
    onSuccess: (updated) => {
      queryClient.setQueryData(['admin', 'employees', 'detail', employee.id], updated)
      void queryClient.invalidateQueries({ queryKey: ['admin', 'employees', 'list'] })
      close()
    },
  })

  function close() {
    setTyped('')
    setEffectiveDate(localToday())
    mutation.reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next || mutation.isPending ? undefined : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>퇴사 처리</DialogTitle>
          <DialogDescription>
            {employee.name} ({employee.employeeNumber}) 님을 퇴사 처리합니다.
          </DialogDescription>
        </DialogHeader>

        <Field id="terminate-date" label="퇴사일 (이 날 0시부터 로그인 차단)">
          <Input
            id="terminate-date"
            type="date"
            min={today}
            value={effectiveDate}
            onChange={(e) => setEffectiveDate(e.target.value)}
          />
        </Field>

        <Alert variant="destructive">
          <AlertDescription>
            {immediate
              ? '즉시 로그인할 수 없게 되고, 진행 중인 모든 로그인 세션이 종료됩니다. 이 작업은 되돌릴 수 없습니다.'
              : `${effectiveDate} 전까지는 재직자로 로그인할 수 있고, 그날 0시부터 로그인이 차단되며 기존 세션도 만료됩니다. 그 전까지는 퇴사일을 바꿀 수 있습니다.`}
          </AlertDescription>
        </Alert>

        {mutation.isError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{errorMessage(mutation.error)}</AlertDescription>
          </Alert>
        )}

        <Field
          id="terminate-confirm"
          label={`확인을 위해 사번 ${employee.employeeNumber} 을(를) 입력하세요`}
        >
          <Input
            id="terminate-confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={employee.employeeNumber}
          />
        </Field>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={mutation.isPending}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={!matches || !effectiveDate || effectiveDate < today || mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? '처리 중…' : '퇴사 처리'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
