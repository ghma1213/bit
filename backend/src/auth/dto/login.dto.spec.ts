import { ValidationPipe } from '@nestjs/common';
import { LoginDto } from './login.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const run = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: LoginDto });

describe('LoginDto', () => {
  it('사번은 공백 제거 + 대문자로 정규화된다', async () => {
    await expect(
      run({ employeeNumber: ' emp-003 ', password: 'x' }),
    ).resolves.toMatchObject({
      employeeNumber: 'EMP-003',
    });
  });
  it('이메일로는 더 이상 로그인할 수 없다', async () => {
    await expect(run({ email: 'a@b.com', password: 'x' })).rejects.toThrow();
  });
  it('사번/비밀번호 누락과 과도한 길이는 거부한다', async () => {
    await expect(run({ password: 'x' })).rejects.toThrow();
    await expect(run({ employeeNumber: 'EMP-001' })).rejects.toThrow();
    await expect(
      run({ employeeNumber: 'E'.repeat(21), password: 'x' }),
    ).rejects.toThrow();
    await expect(
      run({ employeeNumber: 'EMP-001', password: 'x'.repeat(129) }),
    ).rejects.toThrow();
  });
});
