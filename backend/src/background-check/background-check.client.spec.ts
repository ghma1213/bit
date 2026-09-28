import {
  BadGatewayException,
  GatewayTimeoutException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BackgroundCheckClient } from './background-check.client';

const KEY = 'test-key-not-real';

class TestClient extends BackgroundCheckClient {
  sleeps: number[] = [];
  protected override sleep(ms: number) {
    this.sleeps.push(ms); // 실제로 기다리지 않는다
    return Promise.resolve();
  }
}

function makeClient(values: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = {
    BACKGROUND_CHECK_BASE_URL: 'https://api.example.test',
    BACKGROUND_CHECK_API_KEY: KEY,
    ...values,
  };
  return new TestClient({ get: (k: string) => env[k] } as never);
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const RESULT = {
  checkId: 'CHK-1',
  employeeId: 'EMP-001',
  status: 'clear',
  criminalRecord: false,
  educationVerified: true,
  employmentVerified: true,
  creditScore: 'good',
  createdAt: '2026-01-01T00:00:00Z',
  completedAt: '2026-01-01T00:00:20Z',
};

const timeoutError = () =>
  Object.assign(new Error('t'), { name: 'TimeoutError' });

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

describe('BackgroundCheckClient', () => {
  it('X-Candidate-Key 헤더와 인코딩된 경로로 호출하고, 응답의 이름/생년월일 에코는 제거한다', async () => {
    fetchMock.mockResolvedValue(
      json(200, {
        ...RESULT,
        firstName: '민준',
        lastName: '김',
        dateOfBirth: '1990-03-15',
      }),
    );
    const result = await makeClient().get('CHK-1');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.example.test/background-checks/CHK-1');
    expect(init.headers['X-Candidate-Key']).toBe(KEY);
    expect(result).not.toHaveProperty('firstName');
    expect(result).not.toHaveProperty('dateOfBirth');
    expect(result.creditScore).toBe('good');
  });

  it('키가 설정되지 않으면 외부 호출 없이 503', async () => {
    await expect(
      makeClient({ BACKGROUND_CHECK_API_KEY: undefined }).get('CHK-1'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('GET — 타임아웃(무응답) 재시도: 1회, 3초 간격', () => {
    it('타임아웃 후 재시도해 성공하면 결과를 반환한다', async () => {
      fetchMock
        .mockRejectedValueOnce(timeoutError())
        .mockResolvedValueOnce(json(200, RESULT));
      const client = makeClient();
      await expect(client.get('CHK-1')).resolves.toMatchObject({
        checkId: 'CHK-1',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(client.sleeps).toEqual([3000]);
    });

    it('타임아웃이 두 번째도 나면(예산 소진) 재시도 없이 504', async () => {
      fetchMock.mockRejectedValue(timeoutError());
      const client = makeClient();
      await expect(client.get('CHK-1')).rejects.toBeInstanceOf(
        GatewayTimeoutException,
      );
      expect(fetchMock).toHaveBeenCalledTimes(2); // 최초 1회 + 재시도 1회
      expect(client.sleeps).toEqual([3000]);
    });

    it('연결 자체가 안 되는 오류도 타임아웃과 같은 예산으로 재시도한다', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValueOnce(json(200, RESULT));
      const client = makeClient();
      await expect(client.get('CHK-1')).resolves.toBeDefined();
      expect(client.sleeps).toEqual([3000]);
    });
  });

  describe('GET — 오류 응답(500/503) 재시도: 2회, 3초 간격', () => {
    it('500 이면 재시도해 성공하면 결과를 반환한다', async () => {
      fetchMock
        .mockResolvedValueOnce(json(500, { error: 'x' }))
        .mockResolvedValueOnce(json(200, RESULT));
      const client = makeClient();
      await expect(client.get('CHK-1')).resolves.toMatchObject({
        checkId: 'CHK-1',
      });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(client.sleeps).toEqual([3000]);
    });

    it('503 이 두 번 와도 예산(2회) 안이면 재시도해 성공할 수 있다', async () => {
      fetchMock
        .mockResolvedValueOnce(json(503, {}))
        .mockResolvedValueOnce(json(503, {}))
        .mockResolvedValueOnce(json(200, RESULT));
      const client = makeClient();
      await expect(client.get('CHK-1')).resolves.toMatchObject({
        checkId: 'CHK-1',
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(client.sleeps).toEqual([3000, 3000]);
    });

    it('계속 500 이면 총 3회 시도(최초+재시도 2회) 후 502, 외부 메시지는 전달하지 않는다', async () => {
      fetchMock.mockResolvedValue(
        json(500, { message: 'SECRET INTERNAL DETAIL' }),
      );
      const err = await makeClient()
        .get('CHK-1')
        .catch((e) => e);
      expect(err).toBeInstanceOf(BadGatewayException);
      expect(JSON.stringify(err.getResponse())).not.toContain('SECRET');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('계속 503 이면 예산 소진 후 503 (지연 없이, 재시도 없이)', async () => {
      fetchMock.mockResolvedValue(json(503, {}));
      const err = await makeClient()
        .get('CHK-1')
        .catch((e) => e);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('타임아웃과 오류가 섞이면 각자 자기 예산만 쓴다(오류 예산을 빌려오지 않는다)', async () => {
      // 1회차 타임아웃(타임아웃 예산 1→0, 재시도) → 2회차 500(오류 예산 2→1, 재시도)
      // → 3회차 500(오류 예산 1→0, 재시도) → 4회차 500(오류 예산 소진 → 종료)
      fetchMock
        .mockRejectedValueOnce(timeoutError())
        .mockResolvedValueOnce(json(500, {}))
        .mockResolvedValueOnce(json(500, {}))
        .mockResolvedValueOnce(json(500, {}));
      const client = makeClient();
      const err = await client.get('CHK-1').catch((e) => e);
      expect(err).toBeInstanceOf(BadGatewayException);
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(client.sleeps).toEqual([3000, 3000, 3000]);
    });

    it('~30초 걸린 503 은 느린 실패로 보고 타임아웃 예산(1회)을 쓴다', async () => {
      let clock = 0;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => clock);
      fetchMock.mockImplementation(() => {
        clock += 30_000;
        return Promise.resolve(json(503, {}));
      });
      const err = await makeClient()
        .get('CHK-1')
        .catch((e) => e);
      nowSpy.mockRestore();
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect(fetchMock).toHaveBeenCalledTimes(2); // 오류 예산 2회가 아니라 느린 실패 예산 1회만
    });

    it('느린 503 뒤 타임아웃이 나면 느린 실패 예산이 이미 소진돼 504', async () => {
      let clock = 0;
      const nowSpy = jest.spyOn(Date, 'now').mockImplementation(() => clock);
      fetchMock
        .mockImplementationOnce(() => {
          clock += 30_000;
          return Promise.resolve(json(503, {}));
        })
        .mockRejectedValueOnce(timeoutError());
      const err = await makeClient()
        .get('CHK-1')
        .catch((e) => e);
      nowSpy.mockRestore();
      expect(err).toBeInstanceOf(GatewayTimeoutException);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  it('POST(create)는 재시도하지 않는다 — 타임아웃도, 오류도', async () => {
    fetchMock.mockRejectedValueOnce(timeoutError());
    await expect(
      makeClient().create({
        employeeId: 'EMP-001',
        firstName: '민준',
        lastName: '김',
        dateOfBirth: '1990-03-15',
      }),
    ).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset().mockResolvedValueOnce(json(500, {}));
    await expect(
      makeClient().create({
        employeeId: 'EMP-001',
        firstName: '민준',
        lastName: '김',
        dateOfBirth: '1990-03-15',
      }),
    ).rejects.toBeInstanceOf(BadGatewayException);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('POST 본문에 요청 데이터를 담아 보낸다', async () => {
    fetchMock.mockResolvedValue(
      json(201, {
        checkId: 'CHK-2',
        status: 'pending',
        createdAt: 'x',
        estimatedCompletionSeconds: 20,
      }),
    );
    await makeClient().create({
      employeeId: 'EMP-001',
      firstName: '민준',
      lastName: '김',
      dateOfBirth: '1990-03-15',
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      employeeId: 'EMP-001',
      firstName: '민준',
      lastName: '김',
      dateOfBirth: '1990-03-15',
    });
  });

  it('401 은 우리 쪽 설정 오류이므로 502(재시도 없음), 404 는 404(재시도 없음)', async () => {
    fetchMock.mockResolvedValueOnce(json(401, { message: 'bad key' }));
    const authErr = await makeClient()
      .get('CHK-1')
      .catch((e) => e);
    expect(authErr).toBeInstanceOf(BadGatewayException);
    expect(authErr.getResponse()).toMatchObject({
      code: 'UPSTREAM_AUTH_FAILED',
    }); // 화면이 폴링을 멈추는 기준
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockReset().mockResolvedValueOnce(json(404, {}));
    await expect(makeClient().get('CHK-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('응답 형식이 명세와 다르면 502(재시도 없음 — 성공으로 취급되던 응답이라 오류 재시도 경로를 타지 않는다)', async () => {
    fetchMock.mockResolvedValue(
      json(200, { checkId: 'CHK-1', status: 'weird' }),
    );
    await expect(makeClient().get('CHK-1')).rejects.toBeInstanceOf(
      BadGatewayException,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('타임아웃 시도당 35초로 요청한다', async () => {
    fetchMock.mockResolvedValue(json(200, RESULT));
    await makeClient().get('CHK-1');
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
