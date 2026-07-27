import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../../auth/supabase-auth.guard';
import { CreateWhitelistUserDto } from './dto/create-whitelist-user.dto';
import { WhitelistUsersService } from './whitelist-users.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('admin/auth/whitelist-users')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class WhitelistUsersController {
  constructor(private readonly whitelistUsersService: WhitelistUsersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createWhitelistUserDto: CreateWhitelistUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.whitelistUsersService.create(
      createWhitelistUserDto,
      request.user.id,
    );
  }
}
