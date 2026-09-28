import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MaxLength(128)
  currentPassword!: string;

  // 길이 중심 정책(NIST 권고): 12~128자. 상한은 argon2 에 긴 입력을 넣는 DoS 방지.
  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12, { message: '비밀번호는 12자 이상이어야 합니다.' })
  @MaxLength(128)
  newPassword!: string;
}
