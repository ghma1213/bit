import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminEmployeesController } from './admin-employees.controller';
import { AdminEmployeesService } from './admin-employees.service';

@Module({
  imports: [AuthModule],
  controllers: [AdminEmployeesController],
  providers: [AdminEmployeesService],
})
export class AdminModule {}
