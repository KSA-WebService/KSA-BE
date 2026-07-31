import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminUsersService } from './admin-users.service';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('admin/users')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async findAll(@Query() query: GetAdminUsersQueryDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get(':userId')
  async findOne(
    @Param('userId', new ParseUUIDPipe({ version: '4' }))
    userId: string,
  ) {
    return this.adminUsersService.findOne(userId);
  }

  @Patch(':userId')
  async update(
    @Param('userId', new ParseUUIDPipe({ version: '4' }))
    userId: string,
    @Body() dto: UpdateAdminUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.adminUsersService.update(userId, dto, request.user.id);
  }
}
