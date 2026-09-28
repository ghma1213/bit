import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { SessionsService } from '../auth/sessions.service';
import { withDateOnlyBirth } from '../common/date-only';
import {
  effectiveAtKst,
  employmentWhere,
  isTerminated,
  todayKst,
  withStatus,
} from '../common/employment';
import { generateTempPassword } from '../common/password';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQuery } from './dto/list-employees.query';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

// 응답 필드 allowlist (passwordHash 등 내부 필드는 절대 포함하지 않는다)
const LIST_SELECT = {
  id: true,
  employeeNumber: true,
  email: true,
  name: true,
  role: true,
  department: true,
  position: true,
  hiredAt: true,
  terminatedAt: true,
} as const;

const DETAIL_SELECT = {
  ...LIST_SELECT,
  phone: true,
  address: true,
  birthDate: true,
  createdAt: true,
  mustChangePassword: true,
  lockedUntil: true,
} as const;

@Injectable()
export class AdminEmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionsService,
  ) {}

  /** 계정 생성. 임시 비밀번호는 이 응답에서 단 한 번만 반환된다 (저장은 해시만). */
  async create(actorId: string, dto: CreateEmployeeDto) {
    const temporaryPassword = generateTempPassword();
    const passwordHash = await argon2.hash(temporaryPassword);

    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const created = await tx.employee.create({
          data: {
            employeeNumber: dto.employeeNumber,
            email: dto.email,
            name: dto.name,
            role: dto.role ?? 'EMPLOYEE',
            department: dto.department,
            position: dto.position,
            phone: dto.phone,
            address: dto.address,
            birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
            hiredAt: dto.hiredAt ? new Date(dto.hiredAt) : undefined,
            passwordHash,
            mustChangePassword: true,
          },
          select: DETAIL_SELECT,
        });
        await this.audit.record(tx, {
          actorId,
          action: 'EMPLOYEE_CREATED',
          targetId: created.id,
          metadata: { role: created.role },
        });
        return created;
      });
      return {
        employee: withStatus(withDateOnlyBirth(employee)),
        temporaryPassword,
      };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const field = JSON.stringify(e.meta ?? {}).includes('employee_number')
          ? '사번'
          : '이메일';
        throw new ConflictException(`이미 사용 중인 ${field}입니다.`);
      }
      throw e;
    }
  }

  async list(query: ListEmployeesQuery) {
    // 재직/퇴사 조건과 검색 조건이 둘 다 OR 을 쓰므로 AND 로 묶는다
    const where: Prisma.EmployeeWhereInput = {
      AND: [
        query.status ? employmentWhere(query.status) : {},
        query.q
          ? {
              OR: [
                { name: { contains: query.q, mode: 'insensitive' } },
                { employeeNumber: { contains: query.q, mode: 'insensitive' } },
                { email: { contains: query.q, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };
    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.employee.count({ where }),
    ]);
    return {
      items: items.map(withStatus),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async get(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      select: DETAIL_SELECT,
    });
    if (!employee) throw new NotFoundException('직원을 찾을 수 없습니다.');
    return withStatus(withDateOnlyBirth(employee));
  }

  /**
   * 관리자가 기존 직원의 인적사항을 수정한다. 사번/역할/비밀번호는 바꿀 수 없다
   * (UpdateEmployeeDto 참고). 본인 정보 수정(me.service.ts)과 같은 패턴으로,
   * 실제로 바뀐 필드만 변경 전/후 값과 함께 감사 로그(EMPLOYEE_UPDATED)로 남긴다.
   */
  async update(actorId: string, id: string, dto: UpdateEmployeeDto) {
    const before = await this.prisma.employee.findUnique({
      where: { id },
      select: {
        name: true,
        email: true,
        department: true,
        position: true,
        phone: true,
        address: true,
        birthDate: true,
      },
    });
    if (!before) throw new NotFoundException('직원을 찾을 수 없습니다.');

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const result = await tx.employee.update({
          where: { id },
          data: {
            name: dto.name,
            email: dto.email,
            department: dto.department,
            position: dto.position,
            phone: dto.phone,
            address: dto.address,
            birthDate:
              dto.birthDate === undefined
                ? undefined
                : dto.birthDate === null
                  ? null
                  : new Date(dto.birthDate),
          },
          select: DETAIL_SELECT,
        });

        const beforeBirth =
          before.birthDate?.toISOString().slice(0, 10) ?? null;
        const afterBirth = result.birthDate
          ? new Date(result.birthDate).toISOString().slice(0, 10)
          : null;
        const changes: Record<
          string,
          { before: string | null; after: string | null }
        > = {};
        const fields = [
          ['name', before.name, result.name],
          ['email', before.email, result.email],
          ['department', before.department, result.department],
          ['position', before.position, result.position],
          ['phone', before.phone, result.phone],
          ['address', before.address, result.address],
          ['birthDate', beforeBirth, afterBirth],
        ] as const;
        for (const [field, prev, next] of fields) {
          if (prev !== next) changes[field] = { before: prev, after: next };
        }
        if (Object.keys(changes).length > 0) {
          await this.audit.record(tx, {
            actorId,
            action: 'EMPLOYEE_UPDATED',
            targetId: id,
            metadata: changes,
          });
        }
        return result;
      });
      return withStatus(withDateOnlyBirth(updated));
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }
      throw e;
    }
  }

  /**
   * 퇴사 처리 (DECISIONS.md #1). 퇴사일(effectiveDate) 0시(KST)가 효력 시각이다.
   * - 오늘: 즉시 로그인 차단 + 기존 세션 전부 삭제
   * - 미래: "퇴사 예정"으로만 기록. 그때까지는 재직자로 로그인할 수 있고, 효력 시각이 지나면
   *   로그인 검증과 AuthGuard 가 차단한다(이미 로그인된 세션도 다음 요청에서 파기).
   * - 퇴사 예정인 직원에게 다시 요청하면 퇴사일을 바꾼다. 효력이 이미 난 직원은 아무 것도 바꾸지 않는다(멱등).
   * - 본인 퇴사 불가, 마지막 관리자 퇴사 불가. 상태 변경 + 세션 삭제 + 감사 로그는 한 트랜잭션.
   */
  async terminate(actorId: string, id: string, effectiveDate: string) {
    if (id === actorId) {
      throw new BadRequestException('본인 계정은 퇴사 처리할 수 없습니다.');
    }
    const now = new Date();
    if (effectiveDate < todayKst(now)) {
      throw new BadRequestException('퇴사일은 오늘 이후여야 합니다.');
    }
    const terminatedAt = effectiveAtKst(effectiveDate);
    const immediate = isTerminated(terminatedAt, now);

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const target = await tx.employee.findUnique({
            where: { id },
            select: { role: true, terminatedAt: true },
          });
          if (!target) throw new NotFoundException('직원을 찾을 수 없습니다.');
          if (isTerminated(target.terminatedAt, now)) {
            return tx.employee.findUniqueOrThrow({
              where: { id },
              select: DETAIL_SELECT,
            });
          }

          // 퇴사 예정인 관리자도 곧 빠지므로, 대상 외에 퇴사 예정조차 없는 관리자가 남아야 한다
          if (target.role === 'ADMIN') {
            const remainingAdmins = await tx.employee.count({
              where: { role: 'ADMIN', terminatedAt: null, id: { not: id } },
            });
            if (remainingAdmins === 0) {
              throw new ConflictException(
                '마지막 활성 관리자는 퇴사 처리할 수 없습니다.',
              );
            }
          }

          const updated = await tx.employee.update({
            where: { id },
            data: { terminatedAt },
            select: DETAIL_SELECT,
          });
          if (immediate) await this.sessions.revokeAllForUser(id, { tx });
          await this.audit.record(tx, {
            actorId,
            action: 'EMPLOYEE_TERMINATED',
            targetId: id,
            metadata: { effectiveDate },
          });
          return updated;
        },
        // 두 관리자가 동시에 서로를 퇴사시키는 경쟁 상황 방지
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return withStatus(withDateOnlyBirth(result));
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2034'
      ) {
        throw new ConflictException(
          '동시 요청으로 처리하지 못했습니다. 다시 시도해 주세요.',
        );
      }
      throw e;
    }
  }
}
