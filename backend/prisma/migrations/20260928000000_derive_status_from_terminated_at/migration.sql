-- DECISIONS.md #1: 퇴사 효력 시각(terminated_at)이 지나면 퇴사자. 상태를 따로 저장하지 않고 이 값으로만 판단한다.
-- 기존 퇴사자는 terminated_at 이 반드시 있어야 계속 퇴사자로 판단된다.
UPDATE "employees" SET "terminated_at" = COALESCE("terminated_at", now()) WHERE "status" = 'TERMINATED';

ALTER TABLE "employees" DROP COLUMN "status";

DROP TYPE "EmploymentStatus";
