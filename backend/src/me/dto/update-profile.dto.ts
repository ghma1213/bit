import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { trim } from '../../common/transforms';

// 직원 본인이 수정할 수 있는 필드만 정의한다. (여기에 없는 필드는 ValidationPipe 가 400 으로 거부)
// - 필드 생략: 변경 없음 / null: 값 삭제
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '010-1234-5678', nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(/^[0-9+\-() ]{7,20}$/, {
    message: '연락처 형식이 올바르지 않습니다.',
  })
  phone?: string | null;

  @ApiPropertyOptional({ example: '서울시 강남구 테헤란로 1', nullable: true })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  address?: string | null;
}
