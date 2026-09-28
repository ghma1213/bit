import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user';
import { CurrentUser } from '../auth/current-user.decorator';
import { Roles } from '../auth/roles.decorator';
import { AdminEmployeesService } from './admin-employees.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { ListEmployeesQuery } from './dto/list-employees.query';
import { TerminateEmployeeDto } from './dto/terminate-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';

/** 관리자 전용. 클래스 단위 @Roles 로 안의 모든 라우트가 보호된다. */
@ApiTags('admin')
@Roles('ADMIN')
@Controller('admin/employees')
export class AdminEmployeesController {
  constructor(private readonly employees: AdminEmployeesService) {}

  @Post()
  @Header('Cache-Control', 'no-store') // 임시 비밀번호가 캐시에 남지 않도록
  create(@CurrentUser() actor: AuthUser, @Body() dto: CreateEmployeeDto) {
    return this.employees.create(actor.id, dto);
  }

  @Get()
  @Header('Cache-Control', 'no-store')
  list(@Query() query: ListEmployeesQuery) {
    return this.employees.list(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'no-store')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.employees.get(id);
  }

  @Patch(':id')
  @Header('Cache-Control', 'no-store')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.employees.update(actor.id, id, dto);
  }

  @Post(':id/terminate')
  @HttpCode(200)
  terminate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TerminateEmployeeDto,
  ) {
    return this.employees.terminate(actor.id, id, dto.effectiveDate);
  }
}
