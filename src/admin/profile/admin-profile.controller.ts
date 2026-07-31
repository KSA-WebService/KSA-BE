import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminProfileService } from './admin-profile.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('admin')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class AdminProfileController {
  constructor(private readonly adminProfileService: AdminProfileService) {}

  @Get('me')
  async getMe(@Req() request: AuthenticatedRequest) {
    return this.adminProfileService.findMe(request.user.id);
  }
}
