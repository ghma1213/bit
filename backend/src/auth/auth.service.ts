import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { isTerminated } from '../common/employment';
import { PrismaService } from '../prisma/prisma.service';

const INVALID_CREDENTIALS = '사번 또는 비밀번호가 올바르지 않습니다.';

/** 연속 실패 허용 횟수와 잠금 시간 */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

@Injectable()
export class AuthService {
  // 존재하지 않는 계정에도 동일한 검증 비용을 쓰기 위한 더미 해시 (타이밍 차이 제거)
  private dummyHash?: Promise<string>;

  constructor(private readonly prisma: PrismaService) {}

  /** 자격 증명을 검증하고 로그인 가능한 직원의 id 를 반환한다. */
  async validateCredentials(
    employeeNumber: string,
    password: string,
  ): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { employeeNumber },
      select: {
        id: true,
        passwordHash: true,
        terminatedAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    });

    // 계정 상태와 무관하게 항상 검증을 수행해 응답 시간 차이를 없앤다.
    const hash = employee?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await argon2.verify(hash, password);

    if (!employee) throw new UnauthorizedException(INVALID_CREDENTIALS);

    // 잠금 중에는 비밀번호가 맞아도 거부하고, 실패 횟수도 더 올리지 않는다.
    if (employee.lockedUntil && employee.lockedUntil > new Date()) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!passwordOk) {
      await this.registerFailure(employee.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // 퇴사 효력 시각이 지난 직원은 비밀번호가 맞아도 거부 (없음/오류/잠금/퇴사 모두 같은 응답).
    // 퇴사 예정(효력 시각 전)인 직원은 아직 재직자라 로그인할 수 있다.
    if (isTerminated(employee.terminatedAt)) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (employee.failedLoginAttempts > 0 || employee.lockedUntil) {
      await this.prisma.employee.update({
        where: { id: employee.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }
    return employee.id;
  }

  /**
   * 실패 횟수 증가와 잠금 설정을 한 SQL 문으로 처리한다.
   * (읽고-쓰기로 나누면 동시 요청으로 시도 횟수 제한을 우회할 수 있다)
   */
  private async registerFailure(id: string) {
    await this.prisma.$executeRaw`
      UPDATE employees
      SET failed_login_attempts = CASE
            WHEN failed_login_attempts + 1 >= ${MAX_FAILED_ATTEMPTS} THEN 0
            ELSE failed_login_attempts + 1 END,
          locked_until = CASE
            WHEN failed_login_attempts + 1 >= ${MAX_FAILED_ATTEMPTS}
              THEN now() + make_interval(mins => ${LOCK_MINUTES})
            ELSE locked_until END
      WHERE id = ${id}`;
  }

  getMe(id: string) {
    return this.prisma.employee.findUniqueOrThrow({
      where: { id },
      select: {
        id: true,
        employeeNumber: true,
        email: true,
        name: true,
        role: true,
        mustChangePassword: true,
      },
    });
  }

  private getDummyHash() {
    return (this.dummyHash ??= argon2.hash('dummy-password-for-timing'));
  }
}
