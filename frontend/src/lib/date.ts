/**
 * YYYY-MM-DD 형식이고, 실제 존재하는 날짜(2월 31일 불가)이며, 1900-01-01 이후 오늘 이전인지 검사한다.
 * 서버(backend/src/common/calendar-date.ts)와 같은 규칙이다. 최종 검증은 항상 서버가 한다.
 */
export function isPastCalendarDate(value: string, now: Date = new Date()): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d = new Date(Date.UTC(year, month - 1, day))
  const exists = d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day
  return exists && year >= 1900 && d.getTime() <= now.getTime()
}
