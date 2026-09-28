import { ValidationPipe } from '@nestjs/common';
import { UpdateProfileDto } from './dto/update-profile.dto';

// main.ts 와 동일한 옵션으로 검증한다.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const run = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: UpdateProfileDto });

describe('UpdateProfileDto', () => {
  it('허용된 필드는 통과하고 공백은 제거된다', async () => {
    await expect(
      run({ phone: ' 010-1234-5678 ', address: ' 서울 ' }),
    ).resolves.toMatchObject({
      phone: '010-1234-5678',
      address: '서울',
    });
  });
  it('null 은 삭제, 생략은 변경 없음', async () => {
    await expect(run({ phone: null })).resolves.toMatchObject({ phone: null });
    const r = (await run({})) as UpdateProfileDto;
    expect(r.phone).toBeUndefined();
  });
  it.each([
    ['role', 'ADMIN'],
    ['status', 'ACTIVE'],
    ['email', 'a@b.com'],
    ['id', 'x'],
    ['department', 'dev'],
  ])('수정 불가 필드(%s)는 거부한다', async (key, value) => {
    await expect(run({ [key]: value })).rejects.toThrow();
  });
  it('잘못된 연락처와 너무 긴 주소는 거부한다', async () => {
    await expect(run({ phone: 'abc' })).rejects.toThrow();
    await expect(run({ address: 'a'.repeat(201) })).rejects.toThrow();
  });
});
