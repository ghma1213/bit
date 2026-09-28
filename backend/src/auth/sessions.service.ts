import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 특정 직원의 세션을 모두 삭제한다 (퇴사, 비밀번호 변경 시).
   * exceptSid 를 주면 그 세션(현재 세션)만 남긴다. 트랜잭션 클라이언트를 넘기면 같은 트랜잭션으로 묶인다.
   */
  async revokeAllForUser(
    userId: string,
    opts: { tx?: Prisma.TransactionClient; exceptSid?: string } = {},
  ) {
    const db = opts.tx ?? this.prisma;
    if (opts.exceptSid) {
      await db.$executeRaw`DELETE FROM session WHERE sess->>'userId' = ${userId} AND sid <> ${opts.exceptSid}`;
    } else {
      await db.$executeRaw`DELETE FROM session WHERE sess->>'userId' = ${userId}`;
    }
  }
}
