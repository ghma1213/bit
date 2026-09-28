import { BadRequestException, Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { withDateOnlyBirth } from '../common/date-only';
import { PrismaService } from '../prisma/prisma.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

/** DECISIONS.md #4: 본인 정보 수정은 승인 없이 즉시 반영하되, 변경 전후 값과 일시를 이력으로 남긴다. */
const HISTORY_FIELDS = ['phone', 'address'] as const;

// 응답 필드 allowlist: 컬럼이 추가돼도 자동으로 노출되지 않는다 (passwordHash 등 제외)
const PROFILE_SELECT = {
  id: true,
  employeeNumber: true,
  email: true,
  name: true,
  role: true,
  phone: true,
  address: true,
  birthDate: true,
  department: true,
  position: true,
  hiredAt: true,
} as const;

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getProfile(id: string) {
    return withDateOnlyBirth(
      await this.prisma.employee.findUniqueOrThrow({
        where: { id },
        select: PROFILE_SELECT,
      }),
    );
  }

  /**
   * DECISIONS.md #4: 승인 없이 바로 반영하되, 실제로 바뀐 필드만 변경 전/후 값과 함께
   * 감사 로그(actorId = targetId = 본인)로 남긴다. 아무 것도 안 바뀌었으면 기록하지 않는다.
   */
  async updateProfile(id: string, dto: UpdateProfileDto) {
    const before = await this.prisma.employee.findUniqueOrThrow({
      where: { id },
      select: { phone: true, address: true },
    });

    const updated = await this.prisma.employee.update({
      where: { id },
      // undefined 는 Prisma 가 "변경 없음"으로, null 은 "삭제"로 처리한다.
      data: { phone: dto.phone, address: dto.address },
      select: PROFILE_SELECT,
    });

    const changes: Record<
      string,
      { before: string | null; after: string | null }
    > = {};
    for (const field of HISTORY_FIELDS) {
      if (before[field] !== updated[field]) {
        changes[field] = { before: before[field], after: updated[field] };
      }
    }
    if (Object.keys(changes).length > 0) {
      await this.audit.record(this.prisma, {
        actorId: id,
        action: 'PROFILE_UPDATED',
        targetId: id,
        metadata: changes,
      });
    }

    return withDateOnlyBirth(updated);
  }

  /** 현재 비밀번호를 확인하고 새 비밀번호로 교체한다. 임시 비밀번호 강제 변경 상태도 해제한다. */
  async changePassword(id: string, dto: ChangePasswordDto) {
    const employee = await this.prisma.employee.findUniqueOrThrow({
      where: { id },
      select: { passwordHash: true },
    });

    if (!(await argon2.verify(employee.passwordHash, dto.currentPassword))) {
      throw new BadRequestException('현재 비밀번호가 올바르지 않습니다.');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException(
        '새 비밀번호는 현재 비밀번호와 달라야 합니다.',
      );
    }

    await this.prisma.employee.update({
      where: { id },
      data: {
        passwordHash: await argon2.hash(dto.newPassword),
        mustChangePassword: false,
      },
    });
  }
}
