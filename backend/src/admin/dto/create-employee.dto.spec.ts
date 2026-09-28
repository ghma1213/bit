import { ValidationPipe } from '@nestjs/common';
import { CreateEmployeeDto } from './create-employee.dto';
import { describe, expect, it } from '@jest/globals';

const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});
const run = (body: unknown) =>
  pipe.transform(body, { type: 'body', metatype: CreateEmployeeDto });
const base = {
  employeeNumber: 'EMP-011',
  email: 'a@example.com',
  name: '홍길동',
};
const noEmail = { employeeNumber: 'EMP-011', name: '홍길동' };

describe('CreateEmployeeDto', () => {
  it('사번은 대문자로, 이메일은 소문자로 정규화된다', async () => {
    await expect(
      run({ ...base, employeeNumber: ' emp-011 ', email: ' A@Example.COM ' }),
    ).resolves.toMatchObject({
      employeeNumber: 'EMP-011',
      email: 'a@example.com',
    });
  });
  it('사번이 없거나 형식이 틀리면 거부한다', async () => {
    await expect(run({ email: base.email, name: base.name })).rejects.toThrow();
    await expect(run({ ...base, employeeNumber: 'x' })).rejects.toThrow();
    await expect(run({ ...base, employeeNumber: 'EMP 011' })).rejects.toThrow();
  });
  it('이메일은 선택이지만 있으면 형식을 검사한다', async () => {
    await expect(run(noEmail)).resolves.toMatchObject({
      employeeNumber: 'EMP-011',
    });
    await expect(run({ ...noEmail, email: 'not-an-email' })).rejects.toThrow();
  });
  it('비밀번호를 직접 지정할 수 없다', async () => {
    await expect(run({ ...base, password: 'abc' })).rejects.toThrow();
  });
});
