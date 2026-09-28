import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AuditService, type AuditAction } from '../audit/audit.service';
import { isSameName, splitKoreanName } from '../common/korean-name';
import { PrismaService } from '../prisma/prisma.service';
import { BackgroundCheckClient } from './background-check.client';
import type { RequestBackgroundCheckDto } from './dto/request-background-check.dto';

const toDateOnly = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class BackgroundCheckService {
  private readonly logger = new Logger(BackgroundCheckService.name);
  /**
   * 같은 직원에 대한 동시 요청 직렬화 (이중 클릭/동시 관리자 요청으로 조회가 중복 생성되는 것을 막는다).
   * 한계: 프로세스 내부 잠금이라 서버가 여러 대면 부족하다 → 그때는 DB 잠금/유니크 제약 필요.
   */
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly client: BackgroundCheckClient,
    private readonly audit: AuditService,
  ) {}

  /**
   * 요청 화면에 보여줄 값: 규칙으로 나눈 성/이름(관리자가 수정 가능)과 등록된 생년월일(없으면 null).
   * 이름 분리 규칙은 서버에만 두어 화면에 중복 구현하지 않는다.
   */
  async preview(employeeId: string) {
    const employee = await this.findEmployee(employeeId);
    return {
      employeeNumber: employee.employeeNumber,
      name: employee.name,
      ...splitKoreanName(employee.name),
      dateOfBirth: employee.birthDate ? toDateOnly(employee.birthDate) : null,
    };
  }

  /** 새 배경조회 요청. 성/이름은 관리자가 확인·수정한 값을 그대로 외부에 보낸다. */
  async request(
    actorId: string,
    employeeId: string,
    input: RequestBackgroundCheckDto,
  ) {
    const employee = await this.findEmployee(employeeId);

    // 성/이름은 나누는 위치만 바꿀 수 있다: 등록된 직원 본인의 이름과 다른 사람 이름으로는 조회할 수 없다.
    if (!isSameName(employee.name, input.lastName, input.firstName)) {
      throw new BadRequestException(
        `성과 이름을 합친 값이 등록된 이름(${employee.name})과 같아야 합니다.`,
      );
    }

    // 생년월일: 등록된 값이 있으면 그 값만 사용(다른 값은 거부), 없을 때만 입력값을 이번 요청에 한해 사용
    const registered = employee.birthDate
      ? toDateOnly(employee.birthDate)
      : null;
    if (registered && input.dateOfBirth && input.dateOfBirth !== registered) {
      throw new BadRequestException(
        '등록된 생년월일과 다른 값은 사용할 수 없습니다.',
      );
    }
    const dateOfBirth = registered ?? input.dateOfBirth;
    if (!dateOfBirth) {
      throw new UnprocessableEntityException(
        '생년월일 정보가 없어 배경조회를 요청할 수 없습니다.',
      );
    }

    if (this.inFlight.has(employee.id)) {
      throw new ConflictException(
        '같은 직원에 대한 요청을 처리하고 있습니다. 잠시 후 확인해 주세요.',
      );
    }
    this.inFlight.add(employee.id);
    try {
      // 진행 중인 조회가 있으면 새로 만들지 않는다 (POST 는 재시도/취소가 불가능하므로 사전 차단)
      const existing = await this.client.list(employee.employeeNumber);
      if (existing.checks.some((c) => c.status === 'pending')) {
        throw new ConflictException('이미 진행 중인 배경조회가 있습니다.');
      }

      const created = await this.client.create({
        employeeId: employee.employeeNumber,
        firstName: input.firstName,
        lastName: input.lastName,
        dateOfBirth,
      });

      // 값 자체는 남기지 않고 "수정/직접 입력 여부"만 기록한다
      const auto = splitKoreanName(employee.name);
      await this.record(
        actorId,
        'BACKGROUND_CHECK_REQUESTED',
        employee.id,
        created.checkId,
        {
          nameEdited:
            auto.lastName !== input.lastName ||
            auto.firstName !== input.firstName,
          birthDateSupplied: !registered,
        },
      );
      return {
        checkId: created.checkId,
        status: created.status,
        createdAt: created.createdAt,
        estimatedCompletionSeconds: created.estimatedCompletionSeconds ?? null,
      };
    } finally {
      this.inFlight.delete(employee.id);
    }
  }

  /** 직원의 조회 이력 (상태만; 세부 결과는 포함하지 않는다) */
  async list(actorId: string, employeeId: string) {
    const employee = await this.findEmployee(employeeId);
    const { checks } = await this.client.list(employee.employeeNumber);
    await this.record(actorId, 'BACKGROUND_CHECK_LISTED', employee.id);
    return {
      items: checks.map((c) => ({
        checkId: c.checkId,
        status: c.status,
        createdAt: c.createdAt,
        completedAt: c.completedAt ?? null,
      })),
      totalCount: checks.length,
    };
  }

  /**
   * 폴링용 상태 조회. 서버가 외부 상세를 조회하지만 상태와 완료 시각만 돌려주므로
   * 범죄 이력/신용 등급 같은 민감 필드는 브라우저로 나가지 않는다. 결과를 "본 것"이 아니므로 감사 로그도 남기지 않는다.
   */
  async getStatus(employeeId: string, checkId: string) {
    const employee = await this.findEmployee(employeeId);
    const result = await this.client.get(checkId);
    if (result.employeeId !== employee.employeeNumber) {
      throw new NotFoundException('배경조회 결과를 찾을 수 없습니다.');
    }
    return {
      checkId: result.checkId,
      status: result.status,
      completedAt: result.completedAt ?? null,
    };
  }

  /** 조회 결과 상세. 완료된 결과를 볼 때만 감사 로그를 남긴다(pending 폴링은 민감 데이터가 없다). */
  async get(actorId: string, employeeId: string, checkId: string) {
    const employee = await this.findEmployee(employeeId);
    const result = await this.client.get(checkId);

    // URL 의 직원과 결과의 소유 직원이 다르면 없는 것으로 처리한다
    if (result.employeeId !== employee.employeeNumber) {
      throw new NotFoundException('배경조회 결과를 찾을 수 없습니다.');
    }

    if (result.status !== 'pending') {
      await this.record(
        actorId,
        'BACKGROUND_CHECK_VIEWED',
        employee.id,
        result.checkId,
      );
    }
    return {
      checkId: result.checkId,
      status: result.status,
      criminalRecord: result.criminalRecord ?? null,
      educationVerified: result.educationVerified ?? null,
      employmentVerified: result.employmentVerified ?? null,
      creditScore: result.creditScore ?? null,
      createdAt: result.createdAt,
      completedAt: result.completedAt ?? null,
    };
  }

  private async findEmployee(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: { id: true, employeeNumber: true, name: true, birthDate: true },
    });
    if (!employee) throw new NotFoundException('직원을 찾을 수 없습니다.');
    return employee;
  }

  private async record(
    actorId: string,
    action: AuditAction,
    targetId: string,
    checkId?: string,
    extra: Record<string, boolean> = {},
  ) {
    try {
      await this.audit.record(this.prisma, {
        actorId,
        action,
        targetId,
        metadata: checkId ? { checkId, ...extra } : undefined,
      });
    } catch (e) {
      // 외부 요청은 이미 성공했으므로 응답을 잃지 않되, 누락을 추적할 수 있게 크게 남긴다.
      this.logger.error(
        `감사 로그 기록 실패 action=${action} actor=${actorId} target=${targetId} checkId=${checkId ?? '-'}`,
        e instanceof Error ? e.stack : undefined,
      );
    }
  }
}
