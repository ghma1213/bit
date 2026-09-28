import { isPastCalendarDate } from './calendar-date';

const NOW = new Date('2026-09-27T12:00:00Z');

describe('isPastCalendarDate', () => {
  it.each(['1990-03-15', '1900-01-01', '2026-09-27', '2000-02-29'])(
    '%s 는 허용',
    (v) => {
      expect(isPastCalendarDate(v, NOW)).toBe(true);
    },
  );

  it.each([
    ['1990-3-15', '월/일 한 자리'],
    ['1990/03/15', '구분자 다름'],
    ['19900315', '구분자 없음'],
    ['1990-03-15T00:00:00Z', '시각 포함'],
    [' 1990-03-15', '공백'],
    ['1990-02-30', '존재하지 않는 날짜'],
    ['2001-02-29', '평년 2월 29일'],
    ['1990-13-01', '13월'],
    ['1899-12-31', '1900년 이전'],
    ['2026-09-28', '미래'],
    ['', '빈 값'],
  ])('%s 는 거부 (%s)', (v) => {
    expect(isPastCalendarDate(v, NOW)).toBe(false);
  });
});
