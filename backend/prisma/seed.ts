import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { SEED_EMPLOYEES } from './seed-data/employees';

async function main() {
  const adminNumber = (process.env.SEED_ADMIN_EMPLOYEE_NUMBER ?? 'ADM-001').toUpperCase();
  const adminEmail = process.env.SEED_ADMIN_EMAIL || null; // 선택
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword) {
    throw new Error('SEED_ADMIN_PASSWORD 가 필요합니다.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    await prisma.employee.upsert({
      where: { employeeNumber: adminNumber },
      update: {},
      create: {
        employeeNumber: adminNumber,
        email: adminEmail,
        name: '시스템 관리자',
        role: 'ADMIN',
        passwordHash: await argon2.hash(adminPassword),
      },
    });
    console.log(`관리자 계정 준비 완료: ${adminNumber}`);

    // 알려진 비밀번호의 샘플 계정이 운영 DB 에 들어가지 않도록 차단
    if (process.env.NODE_ENV === 'production') {
      console.log('production: 샘플 직원 시드를 건너뜁니다.');
      return;
    }
    const employeePassword = process.env.SEED_EMPLOYEE_PASSWORD;
    if (!employeePassword) {
      throw new Error('SEED_EMPLOYEE_PASSWORD 가 필요합니다. (.env.example 참고)');
    }

    const passwordHash = await argon2.hash(employeePassword);
    for (const e of SEED_EMPLOYEES) {
      await prisma.employee.upsert({
        where: { employeeNumber: e.employeeNumber },
        // 이전 시드가 넣었던 가짜 이메일도 정리한다
        update: { name: e.name, birthDate: e.birthDate ? new Date(e.birthDate) : null, email: null },
        create: {
          employeeNumber: e.employeeNumber,
          name: e.name,
          birthDate: e.birthDate ? new Date(e.birthDate) : null,
          passwordHash,
        },
      });
    }
    console.log(`샘플 직원 ${SEED_EMPLOYEES.length}명 준비 완료`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
