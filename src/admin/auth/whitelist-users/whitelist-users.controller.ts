import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Patch,
  Query,
  Delete,
  Req,
  UseGuards,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../../auth/supabase-auth.guard';
import { CreateWhitelistUserDto } from './dto/create-whitelist-user.dto';
import { WhitelistUsersService } from './whitelist-users.service';
import { GetWhitelistUsersQueryDto } from './dto/get-whitelist-users-query.dto';
import {
  ImportWhitelistUsersDto,
  ImportWhitelistUsersResponse,
} from './dto/import-whitelist-users.dto';
import { UpdateWhitelistUserDto } from './dto/update-whitelist-user.dto';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('admin/auth/whitelist-users')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class WhitelistUsersController {
  constructor(private readonly whitelistUsersService: WhitelistUsersService) {}

  @Get()
  async findAll(@Query() query: GetWhitelistUsersQueryDto) {
    return this.whitelistUsersService.findAll(query);
  }

  @Get(':whitelistUserId')
  async findOne(
    @Param('whitelistUserId', new ParseUUIDPipe({ version: '4' }))
    whitelistUserId: string,
  ) {
    return this.whitelistUsersService.findOne(whitelistUserId);
  }

  @Patch(':whitelistUserId')
  async update(
    @Param('whitelistUserId', new ParseUUIDPipe({ version: '4' }))
    whitelistUserId: string,
    @Body() updateWhitelistUserDto: UpdateWhitelistUserDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.whitelistUsersService.update(
      whitelistUserId,
      updateWhitelistUserDto,
      request.user.id,
    );
  }

  @Delete(':whitelistUserId')
  async remove(
    @Param('whitelistUserId', new ParseUUIDPipe({ version: '4' }))
    whitelistUserId: string,
    @Req() request: { user: { id: string } },
  ) {
    return this.whitelistUsersService.remove(whitelistUserId, request.user.id);
  }

  @Post('import')
  @HttpCode(HttpStatus.OK)
  async importUsers(
    @Body() dto: ImportWhitelistUsersDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ImportWhitelistUsersResponse> {
    return this.whitelistUsersService.importUsers(dto, request.user.id);
  }

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
