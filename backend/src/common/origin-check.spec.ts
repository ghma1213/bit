import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { originCheck } from './origin-check';

const ALLOWED = 'http://localhost:5173';

function run(
  method: string,
  headers: Record<string, string>,
  isProd = false,
): unknown {
  const req = {
    method,
    get: (h: string) => headers[h.toLowerCase()],
  } as unknown as Request;
  let result: unknown = 'not-called';
  originCheck(ALLOWED, isProd)(req, {} as never, (err?: unknown) => {
    result = err;
  });
  return result;
}

describe('originCheck', () => {
  it('GET 은 검사하지 않는다', () => {
    expect(run('GET', { origin: 'http://evil.com' })).toBeUndefined();
  });
  it('허용된 Origin 의 POST 는 통과한다', () => {
    expect(run('POST', { origin: ALLOWED })).toBeUndefined();
  });
  it('다른 Origin 의 POST 는 거부한다', () => {
    expect(run('POST', { origin: 'http://evil.com' })).toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('Origin 이 없으면 Referer 로 판단한다', () => {
    expect(run('PATCH', { referer: `${ALLOWED}/me` })).toBeUndefined();
    expect(run('PATCH', { referer: 'http://evil.com/x' })).toBeInstanceOf(
      ForbiddenException,
    );
  });
  it('Origin/Referer 가 모두 없으면 개발에선 통과, 프로덕션에선 거부한다', () => {
    expect(run('POST', {})).toBeUndefined();
    expect(run('POST', {}, true)).toBeInstanceOf(ForbiddenException);
  });
  it('잘못된 Referer 는 거부한다', () => {
    expect(run('POST', { referer: 'not a url' })).toBeInstanceOf(
      ForbiddenException,
    );
  });
});
