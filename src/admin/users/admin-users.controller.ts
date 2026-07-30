import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminUsersService } from './admin-users.service';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';

@Controller('admin/users')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminUsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  async findAll(@Query() query: GetAdminUsersQueryDto) {
    return this.adminUsersService.findAll(query);
  }
}
