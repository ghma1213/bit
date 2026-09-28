import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Patch,
  Req,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { AuthUser } from '../auth/auth-user';
import { AllowPendingPasswordChange } from '../auth/allow-pending-password-change.decorator';
import { SessionsService } from '../auth/sessions.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ProfileResponse } from './dto/profile.response';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { MeService } from './me.service';

/**
 * 직원 본인 정보. 경로에 ID 를 받지 않고 세션 사용자로만 조회/수정한다 (IDOR 방지).
 */
@ApiTags('me')
@Controller('me')
export class MeController {
  constructor(
    private readonly me: MeService,
    private readonly sessions: SessionsService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store') // 개인정보가 캐시에 남지 않도록
  @ApiOkResponse({ type: ProfileResponse })
  get(@CurrentUser() user: AuthUser) {
    return this.me.getProfile(user.id);
  }

  @Patch()
  @Header('Cache-Control', 'no-store')
  @ApiOkResponse({ type: ProfileResponse })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.me.updateProfile(user.id, dto);
  }

  @AllowPendingPasswordChange()
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 현재 비밀번호 대입 시도 억제
  @Patch('password')
  @HttpCode(204)
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    await this.me.changePassword(user.id, dto);

    // 권한 상태가 바뀌었으므로 세션 ID 를 재발급하고, 이 직원의 다른 세션은 모두 종료한다.
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err: unknown) =>
        err
          ? reject(err instanceof Error ? err : new Error(String(err)))
          : resolve(),
      ),
    );
    req.session.userId = user.id;
    await this.sessions.revokeAllForUser(user.id, { exceptSid: req.sessionID });
  }
}
