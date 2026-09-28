import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BackgroundCheckService } from './background-check.service';

jest.mock('../prisma/prisma.service', () => ({ PrismaService: class {} }));

const EMP = {
  id: 'u1',
  employeeNumber: 'EMP-003',
  name: '남궁서준',
  birthDate: new Date('1988-07-21'),
};

function setup(employee: typeof EMP | { birthDate: null } | null = EMP) {
  const prisma = {
    employee: {
      findUnique: jest
        .fn()
        .mockResolvedValue(employee && { ...EMP, ...employee }),
      update: jest.fn(), // 이 서비스는 직원 정보를 바꾸면 안 된다 (테스트에서 호출 여부를 확인)
    },
  };
  const client = {
    list: jest.fn().mockResolvedValue({ checks: [] }),
    create: jest.fn().mockResolvedValue({
      checkId: 'CHK-9',
      status: 'pending',
      createdAt: 't',
      estimatedCompletionSeconds: 20,
    }),
    get: jest.fn(),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new BackgroundCheckService(
    prisma as never,
    client as never,
    audit,
  );
  return { service, client, audit, prisma };
}

const INPUT = { lastName: '남궁', firstName: '서준' };

describe('BackgroundCheckService.request', () => {
  it('사번을 employeeId 로, 관리자가 확인한 성/이름을 그대로 외부에 보낸다', async () => {
    const { service, client, audit } = setup();
    const res = await service.request('admin', 'u1', INPUT);
    expect(client.create).toHaveBeenCalledWith({
      employeeId: 'EMP-003',
      lastName: '남궁',
      firstName: '서준',
      dateOfBirth: '1988-07-21',
    });
    expect(res).toMatchObject({
      checkId: 'CHK-9',
      status: 'pending',
      estimatedCompletionSeconds: 20,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'BACKGROUND_CHECK_REQUESTED',
        actorId: 'admin',
        targetId: 'u1',
        metadata: {
          checkId: 'CHK-9',
          nameEdited: false,
          birthDateSupplied: false,
        },
      }),
    );
  });

  it('등록된 이름과 다른 성/이름은 외부 호출 없이 400 (나누는 위치만 수정 가능)', async () => {
    const { service, client } = setup();
    for (const bad of [
      { lastName: '홍', firstName: '길동' },
      { lastName: '남궁', firstName: '서주' },
      { lastName: '남궁', firstName: '서준이' },
    ]) {
      await expect(service.request('admin', 'u1', bad)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    }
    expect(client.list).not.toHaveBeenCalled();
    expect(client.create).not.toHaveBeenCalled();
  });

  it('공백만 다른 성/이름은 허용된다', async () => {
    const { service, client } = setup();
    await service.request('admin', 'u1', {
      lastName: ' 남궁 ',
      firstName: ' 서준 ',
    });
    expect(client.create).toHaveBeenCalled();
  });

  it('관리자가 성/이름을 수정하면 수정한 값이 전송되고 감사 로그에는 수정 여부만 남는다', async () => {
    const { service, client, audit } = setup({ ...EMP, name: '선우진' });
    await service.request('admin', 'u1', { lastName: '선', firstName: '우진' }); // 자동 분리는 선우|진
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({ lastName: '선', firstName: '우진' }),
    );
    const meta = audit.record.mock.calls[0][1].metadata;
    expect(meta).toEqual({
      checkId: 'CHK-9',
      nameEdited: true,
      birthDateSupplied: false,
    });
    expect(JSON.stringify(meta)).not.toContain('우진');
  });

  it('생년월일이 없는 직원은 입력값을 이번 요청에만 사용하고 직원 정보는 바꾸지 않는다', async () => {
    const { service, client, audit, prisma } = setup({ birthDate: null });
    await service.request('admin', 'u1', {
      ...INPUT,
      dateOfBirth: '1991-05-05',
    });
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirth: '1991-05-05' }),
    );
    expect(prisma.employee.update).not.toHaveBeenCalled();
    expect(audit.record.mock.calls[0][1].metadata).toMatchObject({
      birthDateSupplied: true,
    });
  });

  it('등록된 생년월일과 다른 값을 보내면 400 (등록된 값은 이 모달에서 바꿀 수 없다)', async () => {
    const { service, client } = setup();
    await expect(
      service.request('admin', 'u1', { ...INPUT, dateOfBirth: '1999-01-01' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.create).not.toHaveBeenCalled();
  });

  it('등록된 생년월일과 같은 값을 보내는 것은 허용된다', async () => {
    const { service, client } = setup();
    await service.request('admin', 'u1', {
      ...INPUT,
      dateOfBirth: '1988-07-21',
    });
    expect(client.create).toHaveBeenCalledWith(
      expect.objectContaining({ dateOfBirth: '1988-07-21' }),
    );
  });

  it('생년월일이 없고 입력도 없으면 외부 호출 없이 422', async () => {
    const { service, client } = setup({ birthDate: null });
    await expect(service.request('admin', 'u1', INPUT)).rejects.toBeInstanceOf(
      UnprocessableEntityException,
    );
    expect(client.list).not.toHaveBeenCalled();
    expect(client.create).not.toHaveBeenCalled();
  });

  it('진행 중(pending) 조회가 있으면 새로 만들지 않고 409', async () => {
    const { service, client } = setup();
    client.list.mockResolvedValue({
      checks: [{ checkId: 'CHK-1', status: 'pending', createdAt: 't' }],
    });
    await expect(service.request('admin', 'u1', INPUT)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(client.create).not.toHaveBeenCalled();
  });

  it('이전 조회가 모두 완료됐으면 새로 요청할 수 있다', async () => {
    const { service, client } = setup();
    client.list.mockResolvedValue({
      checks: [{ checkId: 'CHK-1', status: 'clear', createdAt: 't' }],
    });
    await service.request('admin', 'u1', INPUT);
    expect(client.create).toHaveBeenCalled();
  });

  it('같은 직원에 대한 동시 요청은 하나만 통과한다 (조회 중복 생성 방지)', async () => {
    const { service, client } = setup();
    let release!: () => void;
    client.list.mockImplementation(
      () => new Promise((r) => (release = () => r({ checks: [] }))),
    );
    const first = service.request('admin', 'u1', INPUT);
    await new Promise((r) => setImmediate(r));
    await expect(service.request('admin', 'u1', INPUT)).rejects.toBeInstanceOf(
      ConflictException,
    );
    release();
    await first;
    expect(client.create).toHaveBeenCalledTimes(1);
  });

  it('요청이 실패해도 잠금이 풀려 다시 시도할 수 있다', async () => {
    const { service, client } = setup();
    client.create.mockRejectedValueOnce(new Error('boom'));
    await expect(service.request('admin', 'u1', INPUT)).rejects.toThrow('boom');
    await expect(service.request('admin', 'u1', INPUT)).resolves.toBeDefined();
  });

  it('없는 직원은 404', async () => {
    const { service } = setup(null);
    await expect(
      service.request('admin', 'nope', INPUT),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('감사 로그 기록이 실패해도 이미 만들어진 조회 결과는 돌려준다', async () => {
    const { service, audit } = setup();
    audit.record.mockRejectedValue(new Error('db down'));
    await expect(service.request('admin', 'u1', INPUT)).resolves.toMatchObject({
      checkId: 'CHK-9',
    });
  });
});

describe('BackgroundCheckService.preview', () => {
  it('규칙으로 나눈 성/이름과 등록된 생년월일을 돌려준다', async () => {
    const { service } = setup();
    await expect(service.preview('u1')).resolves.toEqual({
      employeeNumber: 'EMP-003',
      name: '남궁서준',
      lastName: '남궁',
      firstName: '서준',
      dateOfBirth: '1988-07-21',
    });
  });
  it('생년월일이 없으면 null', async () => {
    const { service } = setup({ birthDate: null });
    await expect(service.preview('u1')).resolves.toMatchObject({
      dateOfBirth: null,
    });
  });
  it('없는 직원은 404', async () => {
    const { service } = setup(null);
    await expect(service.preview('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('BackgroundCheckService.get', () => {
  const RESULT = {
    checkId: 'CHK-1',
    employeeId: 'EMP-003',
    status: 'flagged',
    criminalRecord: true,
    educationVerified: true,
    employmentVerified: false,
    creditScore: 'poor',
    createdAt: 't1',
    completedAt: 't2',
  };

  it('완료된 결과를 반환하고 조회를 감사 로그로 남긴다', async () => {
    const { service, client, audit } = setup();
    client.get.mockResolvedValue(RESULT);
    const res = await service.get('admin', 'u1', 'CHK-1');
    expect(res).toMatchObject({
      status: 'flagged',
      criminalRecord: true,
      creditScore: 'poor',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'BACKGROUND_CHECK_VIEWED',
        metadata: { checkId: 'CHK-1' },
      }),
    );
  });

  it('pending 폴링은 감사 로그를 남기지 않고 민감 필드를 null 로 준다', async () => {
    const { service, client, audit } = setup();
    client.get.mockResolvedValue({
      ...RESULT,
      status: 'pending',
      criminalRecord: undefined,
      creditScore: undefined,
      completedAt: null,
    });
    const res = await service.get('admin', 'u1', 'CHK-1');
    expect(res).toMatchObject({
      status: 'pending',
      criminalRecord: null,
      creditScore: null,
    });
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('다른 직원의 조회 결과는 404 (URL 의 직원과 결과의 소유자가 다를 때)', async () => {
    const { service, client, audit } = setup();
    client.get.mockResolvedValue({ ...RESULT, employeeId: 'EMP-999' });
    await expect(service.get('admin', 'u1', 'CHK-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('응답에 이름/생년월일이 포함되지 않는다', async () => {
    const { service, client } = setup();
    client.get.mockResolvedValue({
      ...RESULT,
      firstName: 'x',
      lastName: 'y',
      dateOfBirth: 'z',
    });
    const res = await service.get('admin', 'u1', 'CHK-1');
    expect(Object.keys(res)).not.toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'dateOfBirth']),
    );
  });
});

describe('BackgroundCheckService.getStatus', () => {
  const RESULT = {
    checkId: 'CHK-1',
    employeeId: 'EMP-003',
    status: 'flagged',
    criminalRecord: true,
    educationVerified: true,
    employmentVerified: false,
    creditScore: 'poor',
    createdAt: 't1',
    completedAt: 't2',
  };

  it('상태와 완료 시각만 돌려주고 민감 필드는 포함하지 않는다', async () => {
    const { service, client } = setup();
    client.get.mockResolvedValue(RESULT);
    const res = await service.getStatus('u1', 'CHK-1');
    expect(res).toEqual({
      checkId: 'CHK-1',
      status: 'flagged',
      completedAt: 't2',
    });
    expect(Object.keys(res)).not.toEqual(
      expect.arrayContaining([
        'criminalRecord',
        'creditScore',
        'educationVerified',
      ]),
    );
  });

  it('완료된 결과를 받아도 감사 로그를 남기지 않는다 (사람이 결과를 열람한 것이 아니다)', async () => {
    const { service, client, audit } = setup();
    client.get.mockResolvedValue(RESULT);
    await service.getStatus('u1', 'CHK-1');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('pending 이면 completedAt 은 null', async () => {
    const { service, client } = setup();
    client.get.mockResolvedValue({
      ...RESULT,
      status: 'pending',
      completedAt: undefined,
    });
    await expect(service.getStatus('u1', 'CHK-1')).resolves.toMatchObject({
      status: 'pending',
      completedAt: null,
    });
  });

  it('다른 직원의 조회는 404', async () => {
    const { service, client } = setup();
    client.get.mockResolvedValue({ ...RESULT, employeeId: 'EMP-999' });
    await expect(service.getStatus('u1', 'CHK-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('BackgroundCheckService.list', () => {
  it('상태만 담아 반환하고 이력 조회를 기록한다', async () => {
    const { service, client, audit } = setup();
    client.list.mockResolvedValue({
      checks: [
        {
          checkId: 'CHK-1',
          status: 'clear',
          createdAt: 't',
          completedAt: 't2',
        },
      ],
    });
    const res = await service.list('admin', 'u1');
    expect(res).toEqual({
      items: [
        {
          checkId: 'CHK-1',
          status: 'clear',
          createdAt: 't',
          completedAt: 't2',
        },
      ],
      totalCount: 1,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: 'BACKGROUND_CHECK_LISTED' }),
    );
  });
});
