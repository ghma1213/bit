import { generateTempPassword } from './password';

describe('generateTempPassword', () => {
  it('기본 16자이고 혼동 문자(0 O 1 l I)를 포함하지 않는다', () => {
    for (let i = 0; i < 200; i++) {
      const p = generateTempPassword();
      expect(p).toHaveLength(16);
      expect(p).toMatch(/^[A-HJ-NP-Za-km-z2-9]+$/);
    }
  });
  it('매번 다른 값이 나온다', () => {
    const set = new Set(
      Array.from({ length: 500 }, () => generateTempPassword()),
    );
    expect(set.size).toBe(500);
  });
});
