import { Module } from '@nestjs/common';
import { BackgroundCheckClient } from './background-check.client';
import { BackgroundCheckController } from './background-check.controller';
import { BackgroundCheckService } from './background-check.service';

@Module({
  controllers: [BackgroundCheckController],
  providers: [BackgroundCheckService, BackgroundCheckClient],
})
export class BackgroundCheckModule {}
