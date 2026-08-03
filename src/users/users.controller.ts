import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../auth/supabase-auth.guard';
import { GetMyTokenLogsQueryDto } from './dto/get-my-token-logs-query.dto';
import { UsersService } from './users.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  async getMe(@Req() request: AuthenticatedRequest) {
    return this.usersService.findMe(request.user.id);
  }

  @Get('me/token-logs')
  @UseGuards(SupabaseAuthGuard)
  async getMyTokenLogs(
    @Req() request: AuthenticatedRequest,
    @Query() query: GetMyTokenLogsQueryDto,
  ) {
    return this.usersService.findMyTokenLogs(request.user.id, query);
  }
}
