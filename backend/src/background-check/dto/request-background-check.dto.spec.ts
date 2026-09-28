import { ValidationPipe } from '@nestjs/common';
import { RequestBackgroundCheckDto } from './request-background-check.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const run = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: RequestBackgroundCheckDto });

describe('RequestBackgroundCheckDto', () => {
  it('성/이름은 공백이 제거되고 생년월일은 선택이다', async () => {
    await expect(
      run({ lastName: ' 남궁 ', firstName: ' 서준 ' }),
    ).resolves.toMatchObject({
      lastName: '남궁',
      firstName: '서준',
    });
  });
  it('YYYY-MM-DD 형식의 실제 과거 날짜만 허용한다', async () => {
    await expect(
      run({ lastName: '김', firstName: '솔', dateOfBirth: '1990-03-15' }),
    ).resolves.toBeDefined();
    for (const bad of [
      '1990-3-15',
      '1990/03/15',
      '1990-02-30',
      '2999-01-01',
      '1990-03-15T00:00:00Z',
      '',
    ]) {
      await expect(
        run({ lastName: '김', firstName: '솔', dateOfBirth: bad }),
      ).rejects.toThrow();
    }
  });
  it('성/이름이 비어 있으면 거부한다', async () => {
    await expect(run({ lastName: ' ', firstName: '솔' })).rejects.toThrow();
    await expect(run({ lastName: '김', firstName: '' })).rejects.toThrow();
    await expect(run({ firstName: '솔' })).rejects.toThrow();
  });
  it('알 수 없는 필드(예: employeeId, name)는 거부한다', async () => {
    await expect(
      run({ lastName: '김', firstName: '솔', employeeId: 'EMP-999' }),
    ).rejects.toThrow();
  });
});
