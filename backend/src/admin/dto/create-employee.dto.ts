import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  normalizeEmail,
  normalizeEmployeeNumber,
  trim,
} from '../../common/transforms';

// 비밀번호는 받지 않는다: 서버가 임시 비밀번호를 생성한다.
export class CreateEmployeeDto {
  @ApiProperty({
    example: 'EMP-011',
    description: 'HR 사번 (unique, 대문자로 저장)',
  })
  @Transform(normalizeEmployeeNumber)
  @IsString()
  @Matches(/^[A-Z0-9-]{3,20}$/, {
    message: '사번은 영문 대문자/숫자/하이픈 3~20자여야 합니다.',
  })
  employeeNumber!: string;

  @ApiPropertyOptional({
    example: 'hong@example.com',
    description: '연락용 선택 필드 (로그인 ID 는 사번)',
  })
  @IsOptional()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiProperty({ example: '홍길동' })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'EMPLOYEE'], default: 'EMPLOYEE' })
  @IsOptional()
  @IsIn(['ADMIN', 'EMPLOYEE'])
  role?: 'ADMIN' | 'EMPLOYEE';

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  position?: string;

  @ApiPropertyOptional({ example: '010-1234-5678' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, {
    message: '연락처 형식이 올바르지 않습니다.',
  })
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  address?: string;

  @ApiPropertyOptional({ example: '1990-01-31' })
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string;

  @ApiPropertyOptional({
    example: '2026-09-01',
    description: '생략하면 생성 시각',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  hiredAt?: string;
}
