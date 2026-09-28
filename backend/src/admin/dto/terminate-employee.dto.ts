import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, Matches } from 'class-validator';

export class TerminateEmployeeDto {
  @ApiProperty({
    example: '2026-10-31',
    description:
      '퇴사 효력일. 이 날 0시(KST)부터 로그인이 차단되고 기존 세션도 만료된다. 오늘 이후만 가능.',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: '퇴사일은 YYYY-MM-DD 형식이어야 합니다.',
  })
  @IsDateString({ strict: true }, { message: '존재하지 않는 날짜입니다.' })
  effectiveDate!: string;
}
