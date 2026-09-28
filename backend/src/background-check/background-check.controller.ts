import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  PipeTransform,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { BackgroundCheckService } from './background-check.service';
import { RequestBackgroundCheckDto } from './dto/request-background-check.dto';

/** 외부 URL 경로에 그대로 들어가므로 허용 문자를 제한한다 */
class CheckIdPipe implements PipeTransform<string, string> {
  transform(value: string) {
    if (!/^[A-Za-z0-9_-]{1,80}$/.test(value))
      throw new BadRequestException('잘못된 조회 ID 입니다.');
    return value;
  }
}

/**
 * 관리자 전용(클래스 단위 @Roles). 결과에는 범죄 이력/신용 등급 같은 민감정보가 있으므로
 * 모든 응답에 no-store 를 붙이고, 조회는 감사 로그로 남긴다.
 */
@ApiTags('background-check')
@Roles('ADMIN')
@Controller('admin/employees/:id/background-checks')
export class BackgroundCheckController {
  constructor(private readonly service: BackgroundCheckService) {}

  @Post()
  @HttpCode(201)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Cache-Control', 'no-store')
  request(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RequestBackgroundCheckDto,
  ) {
    return this.service.request(actor.id, id, dto);
  }

  /** 요청 화면용: 자동 분리한 성/이름과 등록된 생년월일. (':checkId' 보다 먼저 선언해야 한다) */
  @Get('preview')
  @Header('Cache-Control', 'no-store')
  preview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.preview(id);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@CurrentUser() actor: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.service.list(actor.id, id);
  }

  /** 폴링용: 상태와 완료 시각만 (민감 필드 없음, 감사 로그 없음) */
  @Get(':checkId/status')
  @Header('Cache-Control', 'no-store')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('checkId', new CheckIdPipe()) checkId: string,
  ) {
    return this.service.getStatus(id, checkId);
  }

  @Get(':checkId')
  @Header('Cache-Control', 'no-store')
  get(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('checkId', new CheckIdPipe()) checkId: string,
  ) {
    return this.service.get(actor.id, id, checkId);
  }
}
