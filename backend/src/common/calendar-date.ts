import { registerDecorator, type ValidationOptions } from 'class-validator';

/**
 * YYYY-MM-DD 형식이고, 실제 존재하는 날짜(2월 31일 불가)이며, 1900-01-01 이후 오늘 이전인지 검사한다.
 * (생년월일 입력용. 서버 기본 시간대와 무관하도록 UTC 기준으로 비교한다)
 */
export function isPastCalendarDate(
  value: string,
  now: Date = new Date(),
): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(Date.UTC(year, month - 1, day));
  const exists =
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day;
  return exists && year >= 1900 && d.getTime() <= now.getTime();
}

export function IsPastCalendarDate(options?: ValidationOptions) {
  return (target: object, propertyName: string) =>
    registerDecorator({
      name: 'isPastCalendarDate',
      target: target.constructor,
      propertyName,
      options: {
        message: '생년월일은 실제 존재하는 과거 날짜(YYYY-MM-DD)여야 합니다.',
        ...options,
      },
      validator: {
        validate: (v: unknown) =>
          typeof v === 'string' && isPastCalendarDate(v),
      },
    });
}
