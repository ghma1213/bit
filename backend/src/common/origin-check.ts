import { ForbiddenException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF 방어(2차): 상태 변경 요청의 Origin(없으면 Referer)이 허용된 프론트 origin 인지 검사한다.
 * 1차 방어는 쿠키의 SameSite=Lax.
 * Origin/Referer 가 모두 없는 요청은 브라우저가 아닌 클라이언트이므로 프로덕션에서만 거부한다.
 */
export function originCheck(allowedOrigin: string, isProd: boolean) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (SAFE_METHODS.has(req.method)) return next();

    const origin = req.get('origin') ?? originOf(req.get('referer'));
    if (origin === undefined) {
      return isProd ? next(new ForbiddenException()) : next();
    }
    if (origin !== allowedOrigin) return next(new ForbiddenException());
    next();
  };
}

function originOf(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return 'invalid';
  }
}
