import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { errorMessage } from '@/api/client'
import { meApi } from '@/api/endpoints'
import { useAuth } from '@/auth/auth-context'
import { Field } from '@/components/Field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { changePasswordSchema, type ChangePasswordValues } from '@/lib/schemas'

export function ChangePasswordPage() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const forced = user?.mustChangePassword ?? false
  const [serverError, setServerError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({ resolver: zodResolver(changePasswordSchema) })

  const onSubmit = handleSubmit(async ({ currentPassword, newPassword }) => {
    setServerError(null)
    setDone(false)
    try {
      await meApi.changePassword(currentPassword, newPassword)
      // 서버가 세션을 새로 발급했으므로(쿠키 교체) 사용자 상태를 다시 읽는다
      await refresh()
      reset()
      if (forced) navigate('/', { replace: true })
      else setDone(true)
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  const passwordField = (
    name: keyof ChangePasswordValues,
    label: string,
    autoComplete: string,
    hint?: string,
  ) => (
    <Field id={name} label={label} error={errors[name]?.message} hint={hint}>
      <Input
        id={name}
        type="password"
        autoComplete={autoComplete}
        aria-invalid={!!errors[name]}
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        {...register(name)}
      />
    </Field>
  )

  return (
    <Card className="mx-auto w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-xl">비밀번호 변경</CardTitle>
        <CardDescription>
          {forced
            ? '임시 비밀번호로 로그인했습니다. 계속하려면 새 비밀번호를 설정하세요.'
            : '현재 비밀번호를 확인한 뒤 새 비밀번호로 변경합니다.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {forced && (
            <Alert>
              <AlertTitle>비밀번호 변경이 필요합니다</AlertTitle>
              <AlertDescription>변경 전에는 다른 화면을 사용할 수 없습니다.</AlertDescription>
            </Alert>
          )}
          {serverError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          {done && (
            <Alert role="status">
              <AlertDescription>비밀번호를 변경했습니다. 다른 기기의 로그인은 모두 종료됩니다.</AlertDescription>
            </Alert>
          )}
          {passwordField('currentPassword', forced ? '임시 비밀번호' : '현재 비밀번호', 'current-password')}
          {passwordField('newPassword', '새 비밀번호', 'new-password', '12자 이상, 현재 비밀번호와 달라야 합니다.')}
          {passwordField('confirmPassword', '새 비밀번호 확인', 'new-password')}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '변경 중…' : '비밀번호 변경'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
