import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AuditAction =
  | 'EMPLOYEE_CREATED'
  | 'EMPLOYEE_UPDATED'
  | 'EMPLOYEE_TERMINATED'
  | 'PROFILE_UPDATED'
  | 'BACKGROUND_CHECK_REQUESTED'
  | 'BACKGROUND_CHECK_LISTED'
  | 'BACKGROUND_CHECK_VIEWED';

@Injectable()
export class AuditService {
  /**
   * 감사 로그 기록. 트랜잭션 클라이언트를 넘기면 대상 행위와 같은 트랜잭션으로 묶인다.
   * metadata 에 비밀번호/조회 결과 같은 민감 값을 넣지 말 것.
   */
  record(
    client: Prisma.TransactionClient | PrismaService,
    entry: {
      actorId: string;
      action: AuditAction;
      targetId?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return client.auditLog.create({ data: entry });
  }
}
