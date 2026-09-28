import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizeEmail, trim } from '../../common/transforms';

/**
 * 관리자가 기존 직원의 인적사항을 수정한다. 사번(employeeNumber)·역할(role)·
 * 비밀번호는 이 API로 바꿀 수 없다 — 역할 변경은 계정 열거/권한 상승 위험이 있는
 * 별도 결정이 필요해서 의도적으로 뺐다(계정 생성 시에만 정할 수 있음).
 * - 필드 생략: 변경 없음 / null: 값 삭제(name 은 제외 — 이름은 지울 수 없음)
 */
export class UpdateEmployeeDto {
  @ApiPropertyOptional({ example: '홍길동' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({ example: 'hong@example.com', nullable: true })
  @IsOptional()
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  department?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  position?: string | null;

  @ApiPropertyOptional({ example: '010-1234-5678', nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, {
    message: '연락처 형식이 올바르지 않습니다.',
  })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  address?: string | null;

  @ApiPropertyOptional({ example: '1990-01-31', nullable: true })
  @IsOptional()
  @IsDateString({ strict: true })
  birthDate?: string | null;
}
