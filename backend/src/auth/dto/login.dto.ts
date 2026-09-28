import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { normalizeEmployeeNumber } from '../../common/transforms';

export class LoginDto {
  // 로그인 ID = 사번. 형식(정규식)은 검사하지 않는다:
  // 형식 오류를 400 으로 구분하면 "없는 계정"과 다른 응답이 되므로 길이만 제한하고 401 로 통일한다.
  @ApiProperty({ example: 'EMP-001' })
  @Transform(normalizeEmployeeNumber)
  @IsString()
  @MinLength(1)
  @MaxLength(20)
  employeeNumber!: string;

  // 길이 상한: argon2 에 아주 긴 입력을 넣는 DoS 를 막는다.
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}
