-- 로그인 ID 가 사번으로 바뀌면서 이메일은 선택 필드가 된다. (기존 데이터는 그대로 유지)
ALTER TABLE "employees" ALTER COLUMN "email" DROP NOT NULL;
