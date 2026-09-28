import type { Role } from '../generated/prisma/enums';

/** 가드가 매 요청마다 DB에서 확인해 request.user 에 넣는 최소 정보. */
export interface AuthUser {
  id: string;
  role: Role;
}
