import { isSameName, splitKoreanName } from './korean-name';

describe('splitKoreanName', () => {
  it.each([
    ['김민준', '김', '민준'],
    ['김솔', '김', '솔'],
    ['남궁서준', '남궁', '서준'],
    ['황보라온', '황보', '라온'],
    ['선우진', '선우', '진'], // 모호한 3글자: 규칙상 복성으로 처리
    ['이서연', '이', '서연'],
    ['시스템 관리자', '시스템', '관리자'], // 공백 우선
    ['  박 민준 ', '박', '민준'],
  ])('%s → %s | %s', (name, last, first) => {
    expect(splitKoreanName(name)).toEqual({ lastName: last, firstName: first });
  });

  it('2글자 이름은 복성으로 자르지 않는다', () => {
    expect(splitKoreanName('남궁')).toEqual({
      lastName: '남',
      firstName: '궁',
    });
  });

  it('분리 후 합치면 원래 이름과 같다', () => {
    for (const n of ['김민준', '남궁서준', '황보라온', '선우진', '이서연']) {
      const { lastName, firstName } = splitKoreanName(n);
      expect(lastName + firstName).toBe(n);
    }
  });
});

describe('isSameName', () => {
  it('나누는 위치만 다르면 같은 이름이다', () => {
    expect(isSameName('선우진', '선우', '진')).toBe(true);
    expect(isSameName('선우진', '선', '우진')).toBe(true);
  });
  it('공백과 유니코드 정규화(NFC/NFD) 차이는 무시한다', () => {
    expect(isSameName('남궁서준', '남궁', ' 서준 ')).toBe(true);
    expect(
      isSameName('김민준', '김'.normalize('NFD'), '민준'.normalize('NFD')),
    ).toBe(true);
  });
  it('글자가 다르거나 빠지거나 더해지면 다른 이름이다', () => {
    expect(isSameName('김민준', '김', '민주')).toBe(false);
    expect(isSameName('김민준', '박', '민준')).toBe(false);
    expect(isSameName('김민준', '김', '민')).toBe(false);
    expect(isSameName('김민준', '김', '민준이')).toBe(false);
  });
  it('순서를 바꾼 이름은 다르다', () => {
    expect(isSameName('김민준', '민준', '김')).toBe(false);
  });
});
