import { MeService } from './me.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const BASE = { id: 'u1', phone: '010-1111-1111', address: '서울' };

function setup(before: Partial<typeof BASE> = {}) {
  const state = { ...BASE, ...before };
  const prisma = {
    employee: {
      findUniqueOrThrow: jest.fn(
        (args: { select?: Record<string, boolean> }) => {
          // updateProfile 는 phone/address 만, getProfile/changePassword 는 다른 select 를 쓴다 — 필요한 것만 돌려준다.
          return Promise.resolve({
            phone: state.phone,
            address: state.address,
            passwordHash: 'irrelevant',
          });
        },
      ),
      update: jest.fn(
        ({
          data,
        }: {
          data: { phone?: string | null; address?: string | null };
        }) => {
          if (data.phone !== undefined) state.phone = data.phone as string;
          if (data.address !== undefined)
            state.address = data.address as string;
          return Promise.resolve({ ...state, birthDate: null });
        },
      ),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new MeService(prisma as never, audit);
  return { service, prisma, audit, state };
}

describe('MeService.updateProfile — DECISIONS.md #4 (승인 없이 즉시 반영 + 변경 이력)', () => {
  it('바뀐 필드만 변경 전/후 값과 함께 감사 로그로 남긴다', async () => {
    const { service, audit } = setup();
    await service.updateProfile('u1', { phone: '010-2222-2222' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorId: 'u1',
        action: 'PROFILE_UPDATED',
        targetId: 'u1',
        metadata: {
          phone: { before: '010-1111-1111', after: '010-2222-2222' },
        },
      }),
    );
  });

  it('여러 필드가 바뀌면 바뀐 필드 전부를 기록한다', async () => {
    const { service, audit } = setup();
    await service.updateProfile('u1', {
      phone: '010-2222-2222',
      address: '부산',
    });

    const meta = (audit.record.mock.calls[0][1] as { metadata: unknown })
      .metadata;
    expect(meta).toEqual({
      phone: { before: '010-1111-1111', after: '010-2222-2222' },
      address: { before: '서울', after: '부산' },
    });
  });

  it('값이 실제로 바뀌지 않으면(동일 값 재제출) 감사 로그를 남기지 않는다', async () => {
    const { service, audit } = setup();
    await service.updateProfile('u1', { phone: '010-1111-1111' });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('필드를 생략하면(변경 없음) 감사 로그를 남기지 않는다', async () => {
    const { service, audit } = setup();
    await service.updateProfile('u1', {});
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('null 로 값을 지우는 것도 변경으로 기록한다', async () => {
    const { service, audit } = setup();
    await service.updateProfile('u1', { phone: null });
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: { phone: { before: '010-1111-1111', after: null } },
      }),
    );
  });

  it('반환값은 즉시 반영된(승인 대기 없는) 새 값이다', async () => {
    const { service } = setup();
    const result = await service.updateProfile('u1', {
      phone: '010-2222-2222',
    });
    expect(result.phone).toBe('010-2222-2222');
  });
});
