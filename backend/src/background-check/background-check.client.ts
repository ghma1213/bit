import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../config/env';

// 응답 스키마: 필요한 필드만 통과시킨다 (z.object 는 모르는 필드를 제거하므로
// 외부 API 가 이름/생년월일을 에코해도 우리 응답으로 새지 않는다).
const status = z.enum(['pending', 'clear', 'flagged']);
const nullableString = z.string().nullable().optional();

const createdSchema = z.object({
  checkId: z.string(),
  status,
  createdAt: z.string(),
  estimatedCompletionSeconds: z.number().optional(),
});
const resultSchema = z.object({
  checkId: z.string(),
  employeeId: z.string(),
  status,
  criminalRecord: z.boolean().nullable().optional(),
  educationVerified: z.boolean().nullable().optional(),
  employmentVerified: z.boolean().nullable().optional(),
  creditScore: z
    .enum(['excellent', 'good', 'fair', 'poor'])
    .nullable()
    .optional(),
  createdAt: z.string(),
  completedAt: nullableString,
});
const listSchema = z.object({
  checks: z.array(
    z.object({
      checkId: z.string(),
      status,
      createdAt: z.string(),
      completedAt: nullableString,
    }),
  ),
});

export type BackgroundCheckCreated = z.infer<typeof createdSchema>;
export type BackgroundCheckResult = z.infer<typeof resultSchema>;
export type BackgroundCheckList = z.infer<typeof listSchema>;

export interface BackgroundCheckInput {
  employeeId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
}

// 아래 값들은 MEASUREMENTS.md 실측을 근거로 정했다(요청 응답 최댓값 ~29.2~30초, 500 은 전부 1초 안,
// 503 은 1초 안 20건 / ~30초 13건으로 둘로 갈림, Retry-After 헤더/바디는 신뢰할 수 없어 사용하지 않음).
/** 시도당 타임아웃. 관측된 최댓값(~30초)보다 여유를 둬 성공할 요청이 타임아웃되지 않게 한다. */
const TIMEOUT_MS = 35_000;
/** 느린 실패(타임아웃, 또는 오래 걸려 돌아온 500/503)에 대한 추가 재시도 횟수 — 한 번에 최대 35초가 걸릴 수 있어 최소로 둔다. */
const TIMEOUT_RETRIES = 1;
/** 빠른 500/503 의 추가 재시도 횟수 — 1초 안에 판명되므로 더 허용한다. */
const ERROR_RETRIES = 2;
/** 이 시간보다 오래 걸린 500/503 은 느린 실패로 보고 TIMEOUT_RETRIES 에서 차감한다(실측상 빠른 오류는 전부 1초 이내). */
const SLOW_FAILURE_MS = 5_000;
/** 재시도 간 고정 대기 시간. */
const RETRY_INTERVAL_MS = 3_000;

/** 외부 배경조회 API 호출 담당. API 키는 서버에만 존재한다. */
@Injectable()
export class BackgroundCheckClient {
  private readonly logger = new Logger(BackgroundCheckClient.name);

  constructor(private readonly config: ConfigService<Env, true>) {}

  create(input: BackgroundCheckInput) {
    // POST 는 멱등 키가 없어 재시도하면 조회가 중복 생성될 수 있으므로 재시도하지 않는다.
    return this.request('create', 'POST', '/background-checks', createdSchema, {
      body: input,
      timeoutRetries: 0,
      errorRetries: 0,
    });
  }

  get(checkId: string) {
    return this.request(
      'get',
      'GET',
      `/background-checks/${encodeURIComponent(checkId)}`,
      resultSchema,
      { timeoutRetries: TIMEOUT_RETRIES, errorRetries: ERROR_RETRIES },
    );
  }

  list(employeeId: string) {
    return this.request(
      'list',
      'GET',
      `/background-checks?employeeId=${encodeURIComponent(employeeId)}`,
      listSchema,
      { timeoutRetries: TIMEOUT_RETRIES, errorRetries: ERROR_RETRIES },
    );
  }

  protected sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async request<T>(
    op: string,
    method: 'GET' | 'POST',
    path: string,
    schema: z.ZodType<T>,
    opts: { body?: unknown; timeoutRetries: number; errorRetries: number },
  ): Promise<T> {
    const baseUrl = this.config.get('BACKGROUND_CHECK_BASE_URL', {
      infer: true,
    });
    const apiKey = this.config.get('BACKGROUND_CHECK_API_KEY', { infer: true });
    if (!baseUrl || !apiKey) {
      this.logger.error(
        `[${op}] BACKGROUND_CHECK_BASE_URL / BACKGROUND_CHECK_API_KEY 미설정`,
      );
      throw new ServiceUnavailableException({
        message: '배경조회 연동이 설정되지 않았습니다. 관리자에게 문의하세요.',
      });
    }

    // 느린 실패(타임아웃·느린 500/503)와 빠른 실패(빠른 500/503) 재시도 예산을 따로 관리한다 —
    // 상태코드가 아니라 실패에 걸린 시간으로 나눈다. ~30초 걸린 503 은 사실상 타임아웃과 같기 때문이다.
    let timeoutRetriesLeft = opts.timeoutRetries;
    let errorRetriesLeft = opts.errorRetries;

    for (let attempt = 1; ; attempt++) {
      let res: Response;
      const startedAt = Date.now();
      try {
        res = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
          method,
          headers: {
            'X-Candidate-Key': apiKey,
            Accept: 'application/json',
            ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
          },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (e) {
        const timeout =
          e instanceof Error &&
          (e.name === 'TimeoutError' || e.name === 'AbortError');
        this.logger.warn(
          `[${op}] 네트워크 오류 (${timeout ? 'timeout' : 'connect'}) 시도 ${attempt}`,
        );
        if (timeoutRetriesLeft > 0) {
          timeoutRetriesLeft--;
          await this.sleep(RETRY_INTERVAL_MS);
          continue;
        }
        throw timeout
          ? new GatewayTimeoutException(
              '배경조회 서비스 응답이 지연되고 있습니다.',
            )
          : new BadGatewayException('배경조회 서비스에 연결할 수 없습니다.');
      }

      if (res.ok) {
        const parsed = schema.safeParse(await res.json().catch(() => null));
        if (!parsed.success) {
          this.logger.error(`[${op}] 응답 형식이 명세와 다릅니다`); // 본문은 기록하지 않는다
          throw new BadGatewayException(
            '배경조회 서비스 응답을 처리할 수 없습니다.',
          );
        }
        return parsed.data;
      }

      // 이하 오류: 외부 오류 본문/메시지는 로그·응답 어디에도 그대로 옮기지 않는다.
      this.logger.warn(`[${op}] 외부 API ${res.status} 시도 ${attempt}`);

      // 요청 자체의 수정이 필요한 오류는 재시도하지 않고 즉시 종료한다.
      if (res.status === 404)
        throw new NotFoundException('배경조회 결과를 찾을 수 없습니다.');
      if (res.status === 401 || res.status === 403) {
        this.logger.error(
          `[${op}] 외부 API 인증 실패 — X-Candidate-Key 를 확인하세요`,
        );
        // 상태코드는 502 지만 재시도로 풀리지 않는 오류라, 화면이 폴링을 멈출 수 있게 코드를 붙인다.
        throw new BadGatewayException({
          message:
            '배경조회 서비스 인증에 실패했습니다. 관리자에게 문의하세요.',
          code: 'UPSTREAM_AUTH_FAILED',
        });
      }

      if (res.status === 500 || res.status === 503) {
        const slow = Date.now() - startedAt > SLOW_FAILURE_MS;
        if (slow ? timeoutRetriesLeft > 0 : errorRetriesLeft > 0) {
          if (slow) timeoutRetriesLeft--;
          else errorRetriesLeft--;
          await this.sleep(RETRY_INTERVAL_MS);
          continue;
        }
        if (res.status === 503) {
          throw new ServiceUnavailableException(
            '배경조회 서비스가 일시적으로 혼잡합니다. 잠시 후 다시 시도해 주세요.',
          );
        }
      }
      throw new BadGatewayException(
        '배경조회 서비스 처리 중 오류가 발생했습니다.',
      );
    }
  }
}
