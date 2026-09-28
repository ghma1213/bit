import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsPastCalendarDate } from '../../common/calendar-date';
import { trim } from '../../common/transforms';

/**
 * 관리자가 확인/수정한 외부 전송 값.
 * - lastName/firstName: 자동 분리 결과를 관리자가 수정한 값 (자유 수정)
 * - dateOfBirth: 직원 정보에 생년월일이 없을 때만 필요. 이번 요청에만 쓰고 저장하지 않는다.
 */
export class RequestBackgroundCheckDto {
  @ApiProperty({ example: '남궁' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: '성을 입력하세요.' })
  @MaxLength(50)
  lastName!: string;

  @ApiProperty({ example: '서준' })
  @Transform(trim)
  @IsString()
  @MinLength(1, { message: '이름을 입력하세요.' })
  @MaxLength(50)
  firstName!: string;

  @ApiPropertyOptional({
    example: '1990-03-15',
    description: '직원 정보에 생년월일이 없을 때만',
  })
  @IsOptional()
  @Transform(trim)
  @IsPastCalendarDate()
  dateOfBirth?: string;
}
