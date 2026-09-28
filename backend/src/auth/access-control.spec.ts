import { Controller, Get, INestApplication, Post, Req } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import session from 'express-session';
import request from 'supertest';
import { AuthGuard } from './auth.guard';
import { AllowPendingPasswordChange } from './allow-pending-password-change.decorator';
import { Public } from './public.decorator';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';
import { PrismaService } from '../prisma/prisma.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

type Row = {
  id: string;
  role: 'ADMIN' | 'EMPLOYEE';
  terminatedAt: Date | null;
  mustChangePassword?: boolean;
};
const db: Record<string, Row> = {
  admin: { id: 'admin', role: 'ADMIN', terminatedAt: null },
  emp: { id: 'emp', role: 'EMPLOYEE', terminatedAt: null },
  temp: {
    id: 'temp',
    role: 'EMPLOYEE',
    terminatedAt: null,
    mustChangePassword: true,
  },
};

@Controller('t')
class TestController {
  // 테스트용 로그인 (세션에 userId 만 저장)
  @Public()
  @Post('login/:id')
  login(@Req() req: Request) {
    req.session.userId = String(req.params.id);
    return { ok: true };
  }
  @Get('any')
  any() {
    return { ok: true };
  }
  @AllowPendingPasswordChange()
  @Get('pw')
  pw() {
    return { ok: true };
  }
  @Roles('ADMIN')
  @Get('admin')
  admin() {
    return { ok: true };
  }
}

@Roles('ADMIN')
@Controller('adm')
class AdminClassController {
  @Get('x')
  x() {
    return { ok: true };
  }
}

describe('접근 제어 (AuthGuard + RolesGuard)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const mod = await Test.createTestingModule({
      controllers: [TestController, AdminClassController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            employee: {
              findUnique: ({ where }: { where: { id: string } }) =>
                Promise.resolve(db[where.id] ?? null),
            },
          },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
      ],
    }).compile();
    app = mod.createNestApplication();
    app.use(
      session({ secret: 'test', resave: false, saveUninitialized: false }),
    );
    await app.init();
  });
  afterAll(() => app.close());

  const login = async (id: string) => {
    const agent = request.agent(app.getHttpServer());
    await agent.post(`/t/login/${id}`).expect(201);
    return agent;
  };

  it('비로그인은 401', async () => {
    await request(app.getHttpServer()).get('/t/any').expect(401);
    await request(app.getHttpServer()).get('/t/admin').expect(401);
  });

  it('직원은 일반 라우트만 가능하고 관리자 라우트는 403', async () => {
    const emp = await login('emp');
    await emp.get('/t/any').expect(200);
    await emp.get('/t/admin').expect(403);
    await emp.get('/adm/x').expect(403); // 클래스 단위 @Roles
  });

  it('관리자는 모두 가능', async () => {
    const admin = await login('admin');
    await admin.get('/t/any').expect(200);
    await admin.get('/t/admin').expect(200);
    await admin.get('/adm/x').expect(200);
  });

  it('역할이 강등되면 기존 세션에도 즉시 반영된다', async () => {
    const admin = await login('admin');
    await admin.get('/t/admin').expect(200);
    db.admin.role = 'EMPLOYEE';
    await admin.get('/t/admin').expect(403);
    db.admin.role = 'ADMIN';
  });

  it('퇴사 처리되면 관리자여도 기존 세션이 즉시 401', async () => {
    const admin = await login('admin');
    await admin.get('/t/admin').expect(200);
    db.admin.terminatedAt = new Date(Date.now() - 1000); // 효력 시각이 막 지남
    await admin.get('/t/admin').expect(401);
    db.admin.terminatedAt = null;
  });

  it('퇴사 예정(효력 시각 전)이면 기존 세션이 유지된다', async () => {
    const emp = await login('emp');
    db.emp.terminatedAt = new Date(Date.now() + 60_000);
    await emp.get('/t/any').expect(200);
    db.emp.terminatedAt = new Date(Date.now() - 1000); // 효력 시각 도달
    await emp.get('/t/any').expect(401);
    db.emp.terminatedAt = null;
  });

  it('존재하지 않는 사용자의 세션은 401', async () => {
    const ghost = await login('ghost');
    await ghost.get('/t/any').expect(401);
  });

  it('임시 비밀번호 상태에서는 허용된 라우트 외 모두 403(PASSWORD_CHANGE_REQUIRED)', async () => {
    const temp = await login('temp');
    const res = await temp.get('/t/any').expect(403);
    expect(res.body.code).toBe('PASSWORD_CHANGE_REQUIRED');
    await temp.get('/t/pw').expect(200);
    await temp.get('/adm/x').expect(403);
  });

  it('비밀번호를 변경하면(플래그 해제) 정상 접근된다', async () => {
    const temp = await login('temp');
    await temp.get('/t/any').expect(403);
    db.temp.mustChangePassword = false;
    await temp.get('/t/any').expect(200);
    db.temp.mustChangePassword = true;
  });
});
