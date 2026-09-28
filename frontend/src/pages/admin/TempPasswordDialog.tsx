import { useState } from 'react'
import type { CreateEmployeeResult } from '@/api/types'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * 계정 생성 직후 임시 비밀번호를 한 번만 보여준다.
 * - 비밀번호는 props(=부모 state)에만 존재하고, 이 컴포넌트가 unmount 되면 사라진다.
 *   URL/localStorage/쿼리 캐시에는 저장하지 않는다.
 * - "전달했습니다"를 체크하기 전에는 닫을 수 없다(Esc/바깥 클릭 포함).
 * 부모는 key 를 바꿔 매번 새로 마운트해야 한다(체크 상태 초기화).
 */
export function TempPasswordDialog({
  result,
  onClose,
}: {
  result: CreateEmployeeResult
  onClose: () => void
}) {
  const [delivered, setDelivered] = useState(false)
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.temporaryPassword)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && delivered && onClose()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>직원을 등록했습니다</DialogTitle>
          <DialogDescription>
            {result.employee.name} ({result.employee.employeeNumber})
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTitle>이 비밀번호는 다시 볼 수 없습니다</AlertTitle>
          <AlertDescription>
            창을 닫으면 서버에도 화면에도 남지 않습니다. 지금 복사해서 직원에게 안전하게 전달하세요.
          </AlertDescription>
        </Alert>

        <div className="flex items-center gap-2">
          <code
            aria-label="임시 비밀번호"
            className="flex-1 rounded-lg border bg-muted px-3 py-2 font-mono text-base tracking-wider select-all"
          >
            {result.temporaryPassword}
          </code>
          <Button variant="outline" onClick={copy}>
            {copyState === 'copied' ? '복사됨' : '복사'}
          </Button>
        </div>
        <p role="status" className="min-h-4 text-xs text-muted-foreground">
          {copyState === 'copied' && '클립보드에 복사했습니다.'}
          {copyState === 'failed' && '자동 복사에 실패했습니다. 비밀번호를 직접 선택해 복사하세요.'}
        </p>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={delivered} onCheckedChange={(v) => setDelivered(v === true)} />
          임시 비밀번호를 직원에게 전달했습니다
        </label>

        <DialogFooter>
          <Button onClick={onClose} disabled={!delivered}>
            닫기
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
