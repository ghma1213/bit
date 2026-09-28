import { SetMetadata } from '@nestjs/common';
import type { Role } from '../generated/prisma/enums';

export const ROLES_KEY = 'roles';

/**
 * 허용할 역할을 지정한다. 클래스(컨트롤러)에 붙이면 안의 모든 라우트에 적용된다.
 * 붙이지 않은 라우트는 로그인한 모든 직원이 접근할 수 있다.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
