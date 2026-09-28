import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { errorMessage } from '@/api/client'
import { meApi } from '@/api/endpoints'
import type { Profile } from '@/api/types'
import { Field } from '@/components/Field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { profileSchema, type ProfileValues } from '@/lib/schemas'

const PROFILE_KEY = ['me', 'profile'] as const
const dash = (v: string | null) => v || '-'

function ReadOnlyRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  )
}

export function MyProfilePage() {
  const { data, isPending, error, refetch } = useQuery({ queryKey: PROFILE_KEY, queryFn: meApi.get })

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }
  if (error) {
    return (
      <Alert variant="destructive" role="alert">
        <AlertDescription className="flex items-center justify-between gap-4">
          {errorMessage(error)}
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            다시 시도
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">내 정보</CardTitle>
          <CardDescription>이름, 부서 등 인사 정보는 관리자만 수정할 수 있습니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3">
            <ReadOnlyRow label="사번" value={data.employeeNumber} />
            <ReadOnlyRow label="이름" value={data.name} />
            <ReadOnlyRow label="구분" value={<Badge variant="secondary">{data.role === 'ADMIN' ? '관리자' : '직원'}</Badge>} />
            <ReadOnlyRow label="이메일" value={dash(data.email)} />
            <ReadOnlyRow label="생년월일" value={dash(data.birthDate)} />
            <ReadOnlyRow label="입사일" value={new Date(data.hiredAt).toLocaleDateString('ko-KR')} />
            <ReadOnlyRow label="부서" value={dash(data.department)} />
            <ReadOnlyRow label="직책" value={dash(data.position)} />
          </dl>
        </CardContent>
      </Card>
      <ContactForm profile={data} />
    </div>
  )
}

function ContactForm({ profile }: { profile: Profile }) {
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    // 서버 데이터가 바뀌면(저장 성공 후) 폼이 그 값으로 다시 초기화된다
    values: { phone: profile.phone ?? '', address: profile.address ?? '' },
  })

  const mutation = useMutation({
    mutationFn: (v: ProfileValues) =>
      // 빈 문자열은 "삭제"(null) 로 보낸다
      meApi.update({ phone: v.phone || null, address: v.address || null }),
    onSuccess: (updated) => queryClient.setQueryData(PROFILE_KEY, updated),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">연락처 수정</CardTitle>
        <CardDescription>연락처와 주소는 직접 수정할 수 있습니다.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          noValidate
          className="flex max-w-md flex-col gap-4"
        >
          {mutation.isError && (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{errorMessage(mutation.error)}</AlertDescription>
            </Alert>
          )}
          {mutation.isSuccess && !isDirty && (
            <Alert role="status">
              <AlertDescription>저장했습니다.</AlertDescription>
            </Alert>
          )}
          <Field id="phone" label="연락처" error={errors.phone?.message} hint="예: 010-1234-5678">
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              aria-invalid={!!errors.phone}
              aria-describedby={errors.phone ? 'phone-error' : undefined}
              {...register('phone')}
            />
          </Field>
          <Field id="address" label="주소" error={errors.address?.message}>
            <Input
              id="address"
              autoComplete="street-address"
              aria-invalid={!!errors.address}
              aria-describedby={errors.address ? 'address-error' : undefined}
              {...register('address')}
            />
          </Field>
          <div>
            <Button type="submit" disabled={!isDirty || mutation.isPending}>
              {mutation.isPending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
