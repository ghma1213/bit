-- 기존 행이 있어도 적용되도록: NULL 허용으로 추가 → 채움 → NOT NULL + UNIQUE
ALTER TABLE "employees" ADD COLUMN "employee_number" TEXT;

UPDATE "employees" e
SET "employee_number" = x.prefix || '-' || lpad(x.rn::text, 3, '0')
FROM (
  SELECT id,
         CASE WHEN role = 'ADMIN' THEN 'ADM' ELSE 'MIG' END AS prefix,
         row_number() OVER (PARTITION BY role ORDER BY created_at, id) AS rn
  FROM "employees"
) x
WHERE e.id = x.id;

ALTER TABLE "employees" ALTER COLUMN "employee_number" SET NOT NULL;

CREATE UNIQUE INDEX "employees_employee_number_key" ON "employees"("employee_number");
