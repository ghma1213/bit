import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { AuthUser } from './auth-user';
import { AllowPendingPasswordChange } from './allow-pending-password-change.decorator';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

const SESSION_COOKIE = 'sid';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // IP당 분당 10회
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const userId = await this.auth.validateCredentials(
      dto.employeeNumber,
      dto.password,
    );

    // 세션 고정 방지: 로그인 성공 시 세션 ID 를 새로 발급한다.
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err: unknown) =>
        err
          ? reject(err instanceof Error ? err : new Error(String(err)))
          : resolve(),
      ),
    );
    req.session.userId = userId;

    return this.auth.getMe(userId);
  }

  // 세션이 이미 만료/파기된 상태에서도 멱등하게 쿠키를 정리할 수 있어야 하므로 Public
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
    res.clearCookie(SESSION_COOKIE);
  }

  @AllowPendingPasswordChange()
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.auth.getMe(user.id);
  }
}
