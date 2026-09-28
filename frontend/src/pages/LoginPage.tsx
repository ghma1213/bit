import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/api/client'
import { useAuth } from '@/auth/auth-context'
import { Field } from '@/components/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { loginSchema, type LoginValues } from '@/lib/schemas'

export function LoginPage() {
  const { login } = useAuth()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  // 성공하면 AuthProvider 상태가 바뀌고 GuestOnly 가드가 알맞은 화면으로 이동시킨다.
  const onSubmit = handleSubmit(async ({ employeeNumber, password }) => {
    setServerError(null)
    try {
      await login(employeeNumber, password)
    } catch (e) {
      setServerError(errorMessage(e))
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">로그인</CardTitle>
          <CardDescription>사번과 비밀번호를 입력하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            {serverError && (
              <Alert variant="destructive" role="alert">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <Field id="employeeNumber" label="사번" error={errors.employeeNumber?.message}>
              <Input
                id="employeeNumber"
                autoComplete="username"
                autoFocus
                placeholder="EMP-001"
                aria-invalid={!!errors.employeeNumber}
                aria-describedby={errors.employeeNumber ? 'employeeNumber-error' : undefined}
                {...register('employeeNumber')}
              />
            </Field>
            <Field id="password" label="비밀번호" error={errors.password?.message}>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
            </Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? '로그인 중…' : '로그인'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
