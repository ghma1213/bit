import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { isTerminated } from '../common/employment';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from './auth-user';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from './allow-pending-password-change.decorator';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const userId = req.session?.userId;
    if (!userId) throw new UnauthorizedException();

    // 세션의 값을 믿지 않고 매 요청마다 현재 상태를 확인한다. 퇴사 효력 시각이 지나면
    // 이미 로그인된 세션도 다음 요청에서 바로 파기된다 (DECISIONS.md #1, 예약 퇴사도 배치 없이 처리).
    const employee = await this.prisma.employee.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        terminatedAt: true,
        mustChangePassword: true,
      },
    });
    if (!employee || isTerminated(employee.terminatedAt)) {
      await new Promise<void>((resolve) =>
        req.session.destroy(() => resolve()),
      );
      throw new UnauthorizedException();
    }

    // 임시 비밀번호 상태에서는 비밀번호 변경 관련 라우트만 허용한다.
    if (employee.mustChangePassword) {
      const allowed = this.reflector.getAllAndOverride<boolean>(
        ALLOW_PENDING_PASSWORD_CHANGE_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (!allowed) {
        throw new ForbiddenException({
          message: '비밀번호를 먼저 변경해야 합니다.',
          code: 'PASSWORD_CHANGE_REQUIRED',
        });
      }
    }

    req.user = { id: employee.id, role: employee.role };
    return true;
  }
}
