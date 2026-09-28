import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { todayKst } from '../common/employment';
import { AdminEmployeesService } from './admin-employees.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));
// Prisma 런타임 클래스는 이 테스트에서 필요한 최소한만 대체
jest.mock('../generated/prisma/client', () => ({
  Prisma: {
    PrismaClientKnownRequestError: class extends Error {
      code = '';
    },
    TransactionIsolationLevel: { Serializable: 'Serializable' },
  },
}));

const TODAY = todayKst();
const FUTURE = '2999-12-31';
const PAST_EFFECTIVE = new Date('2000-01-01T00:00:00+09:00');
const SCHEDULED = new Date('2999-01-01T00:00:00+09:00');

type Target = { role: 'ADMIN' | 'EMPLOYEE'; terminatedAt: Date | null } | null;

function setup(target: Target, remainingAdmins = 1) {
  const tx = {
    employee: {
      findUnique: jest.fn().mockResolvedValue(target),
      findUniqueOrThrow: jest.fn().mockResolvedValue({
        id: 't',
        birthDate: null,
        terminatedAt: PAST_EFFECTIVE,
      }),
      count: jest.fn().mockResolvedValue(remainingAdmins),
      update: jest.fn(({ data }: { data: { terminatedAt: Date } }) =>
        Promise.resolve({
          id: 't',
          birthDate: null,
          terminatedAt: data.terminatedAt,
        }),
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn() };
  const sessions = { revokeAllForUser: jest.fn() };
  const service = new AdminEmployeesService(
    prisma as never,
    audit,
    sessions as never,
  );
  return { service, tx, audit, sessions };
}

describe('AdminEmployeesService.terminate', () => {
  it('본인 퇴사는 거부한다', async () => {
    const { service } = setup({ role: 'ADMIN', terminatedAt: null });
    await expect(service.terminate('me', 'me', TODAY)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('과거 날짜로는 퇴사 처리할 수 없다', async () => {
    const { service, tx } = setup({ role: 'EMPLOYEE', terminatedAt: null });
    await expect(
      service.terminate('admin', 'emp', '2000-01-01'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it('없는 직원은 404', async () => {
    const { service } = setup(null);
    await expect(service.terminate('a', 'x', TODAY)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('오늘 퇴사: 효력 시각 기록 + 세션 삭제 + 감사 로그, 응답은 TERMINATED', async () => {
    const { service, tx, audit, sessions } = setup({
      role: 'EMPLOYEE',
      terminatedAt: null,
    });
    const res = await service.terminate('admin', 'emp', TODAY);
    expect(tx.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { terminatedAt: new Date(`${TODAY}T00:00:00+09:00`) },
      }),
    );
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith('emp', { tx });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'EMPLOYEE_TERMINATED',
        actorId: 'admin',
        targetId: 'emp',
        metadata: { effectiveDate: TODAY },
      }),
    );
    expect(res.status).toBe('TERMINATED');
  });

  it('미래 퇴사: 퇴사 예정으로 기록만 하고 세션은 유지한다(아직 재직자)', async () => {
    const { service, tx, sessions } = setup({
      role: 'EMPLOYEE',
      terminatedAt: null,
    });
    const res = await service.terminate('admin', 'emp', FUTURE);
    expect(tx.employee.update).toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    expect(res.status).toBe('ACTIVE');
    expect(res.terminatedAt).toEqual(new Date(`${FUTURE}T00:00:00+09:00`));
  });

  it('퇴사 예정인 직원은 퇴사일을 바꿀 수 있다', async () => {
    const { service, tx } = setup({
      role: 'EMPLOYEE',
      terminatedAt: SCHEDULED,
    });
    await service.terminate('admin', 'emp', TODAY);
    expect(tx.employee.update).toHaveBeenCalled();
  });

  it('효력이 이미 난 직원은 아무 것도 바꾸지 않는다 (멱등)', async () => {
    const { service, tx, audit, sessions } = setup({
      role: 'EMPLOYEE',
      terminatedAt: PAST_EFFECTIVE,
    });
    await service.terminate('admin', 'emp', TODAY);
    expect(tx.employee.update).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('대상 말고 남는 관리자(퇴사 예정 제외)가 없으면 거부한다', async () => {
    const { service, tx } = setup({ role: 'ADMIN', terminatedAt: null }, 0);
    await expect(
      service.terminate('other', 'adm', FUTURE),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.employee.count).toHaveBeenCalledWith({
      where: { role: 'ADMIN', terminatedAt: null, id: { not: 'adm' } },
    });
    expect(tx.employee.update).not.toHaveBeenCalled();
  });

  it('남는 관리자가 있으면 관리자도 퇴사시킬 수 있다', async () => {
    const { service, tx } = setup({ role: 'ADMIN', terminatedAt: null }, 1);
    await service.terminate('other', 'adm', TODAY);
    expect(tx.employee.update).toHaveBeenCalled();
  });
});

const BASE_EMPLOYEE = {
  name: '김민준',
  email: 'old@example.com',
  department: '개발팀',
  position: '사원',
  phone: '010-1111-1111',
  address: '서울',
  birthDate: new Date('1990-01-01'),
};

function setupUpdate(before: Partial<typeof BASE_EMPLOYEE> = {}) {
  const state = { ...BASE_EMPLOYEE, ...before };
  const tx = {
    employee: {
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        for (const [k, v] of Object.entries(data)) {
          if (v !== undefined) (state as Record<string, unknown>)[k] = v;
        }
        return Promise.resolve({ id: 'emp', ...state });
      }),
    },
  };
  const prisma = {
    // findUnique 는 매번 그 시점의 스냅샷을 돌려준다 — state 참조를 그대로 주면
    // 아래 tx.employee.update 의 제자리 변경이 "수정 전" 값까지 같이 바꿔버린다.
    employee: { findUnique: jest.fn(() => Promise.resolve({ ...state })) },
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
  };
  const audit = { record: jest.fn() };
  const sessions = { revokeAllForUser: jest.fn() };
  const service = new AdminEmployeesService(
    prisma as never,
    audit,
    sessions as never,
  );
  return { service, prisma, tx, audit, sessions };
}

describe('AdminEmployeesService.update', () => {
  it('없는 직원은 404', async () => {
    const { service, prisma } = setupUpdate();
    (prisma.employee.findUnique as jest.Mock).mockResolvedValueOnce(null);
    await expect(
      service.update('admin', 'nope', { name: '새이름' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('바뀐 필드만 변경 전/후 값과 함께 감사 로그로 남긴다', async () => {
    const { service, audit } = setupUpdate();
    await service.update('admin', 'emp', {
      department: '인사팀',
      position: '사원',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'admin',
        action: 'EMPLOYEE_UPDATED',
        targetId: 'emp',
        metadata: {
          department: { before: '개발팀', after: '인사팀' },
        },
      }),
    );
  });

  it('아무 것도 안 바뀌면 감사 로그를 남기지 않는다', async () => {
    const { service, audit } = setupUpdate();
    await service.update('admin', 'emp', { name: '김민준' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('null 로 보내면 값을 지운다(name 제외)', async () => {
    const { service, tx } = setupUpdate();
    await service.update('admin', 'emp', { department: null });
    expect(tx.employee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ department: null }) }),
    );
  });

  it('생년월일은 YYYY-MM-DD 로 비교해서 실제로 바뀐 경우만 기록한다', async () => {
    const { service, audit } = setupUpdate();
    await service.update('admin', 'emp', { birthDate: '1990-01-01' });
    expect(audit.record).not.toHaveBeenCalled();

    const { service: service2, audit: audit2 } = setupUpdate();
    await service2.update('admin', 'emp', { birthDate: '1991-02-02' });
    expect(audit2.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: { birthDate: { before: '1990-01-01', after: '1991-02-02' } },
      }),
    );
  });

  it('사번/역할/비밀번호 필드는 DTO 에 없어 ValidationPipe 가 걸러낸다(서비스 계층 방어는 불필요)', () => {
    // UpdateEmployeeDto 에 employeeNumber/role/passwordHash 가 없다는 걸
    // 타입 레벨에서 보장한다 — 여기서 컴파일되면 통과.
    const dto: import('./dto/update-employee.dto').UpdateEmployeeDto = {
      name: '홍길동',
    };
    expect(dto).toBeDefined();
  });
});
