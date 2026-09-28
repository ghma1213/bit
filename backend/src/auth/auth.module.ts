import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { RolesGuard } from './roles.guard';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionsService,
    // 순서 중요: 인증(AuthGuard)이 request.user 를 채운 뒤 권한(RolesGuard)을 검사한다.
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [SessionsService],
})
export class AuthModule {}
