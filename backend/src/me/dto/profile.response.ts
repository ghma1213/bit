import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponse {
  @ApiProperty() id!: string;
  @ApiProperty({ example: 'EMP-001' }) employeeNumber!: string;
  @ApiProperty({ nullable: true }) email!: string | null;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ['ADMIN', 'EMPLOYEE'] }) role!: string;
  @ApiProperty({ nullable: true }) phone!: string | null;
  @ApiProperty({ nullable: true }) address!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date' })
  birthDate!: Date | null;
  @ApiProperty({ nullable: true }) department!: string | null;
  @ApiProperty({ nullable: true }) position!: string | null;
  @ApiProperty() hiredAt!: Date;
}
