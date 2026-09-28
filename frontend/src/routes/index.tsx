import { createBrowserRouter, Navigate } from 'react-router-dom'
import { GuestOnly, HomeRedirect, RequireAuth, RequireRole } from '@/auth/guards'
import { AppLayout } from '@/components/AppLayout'
import { ChangePasswordPage } from '@/pages/ChangePasswordPage'
import { LoginPage } from '@/pages/LoginPage'
import { MyProfilePage } from '@/pages/MyProfilePage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { EmployeeDetailPage } from '@/pages/admin/EmployeeDetailPage'
import { EmployeeListPage } from '@/pages/admin/EmployeeListPage'

// 가드는 화면 이동(UX)용이다. 데이터 접근 통제는 서버가 최종 기준이다.
export const router = createBrowserRouter([
  { path: '/', element: <HomeRedirect /> },
  {
    path: '/login',
    element: (
      <GuestOnly>
        <LoginPage />
      </GuestOnly>
    ),
  },
  {
    // 임시 비밀번호 상태에서도 접근 가능한 유일한 인증 화면
    element: <RequireAuth allowPasswordChange />,
    children: [{ element: <AppLayout />, children: [{ path: '/change-password', element: <ChangePasswordPage /> }] }],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/me', element: <MyProfilePage /> },
          {
            element: <RequireRole role="ADMIN" />,
            children: [
              { path: '/admin', element: <Navigate to="/admin/employees" replace /> },
              { path: '/admin/employees', element: <EmployeeListPage /> },
              { path: '/admin/employees/:id', element: <EmployeeDetailPage /> },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
