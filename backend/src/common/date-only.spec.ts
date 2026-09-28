import { withDateOnlyBirth } from './date-only';

describe('withDateOnlyBirth', () => {
  it('시각 없이 YYYY-MM-DD 로 변환한다', () => {
    expect(
      withDateOnlyBirth({ birthDate: new Date('1988-07-21') }).birthDate,
    ).toBe('1988-07-21');
  });
  it('null 은 null 유지', () => {
    expect(withDateOnlyBirth({ birthDate: null }).birthDate).toBeNull();
  });
  it('다른 필드는 그대로 둔다', () => {
    expect(withDateOnlyBirth({ id: 'x', birthDate: null })).toEqual({
      id: 'x',
      birthDate: null,
    });
  });
});
