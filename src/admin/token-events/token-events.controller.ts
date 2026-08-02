import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CreateTokenEventDto } from './dto/create-token-event.dto';
import { GetTokenEventDetailQueryDto } from './dto/get-token-event-detail-query.dto';
import { GetTokenEventsQueryDto } from './dto/get-token-events-query.dto';
import { TokenEventsService } from './token-events.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('admin/token-events')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class TokenEventsController {
  constructor(private readonly tokenEventsService: TokenEventsService) {}

  @Post()
  async create(
    @Body() dto: CreateTokenEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tokenEventsService.create(dto, request.user.id);
  }

  @Get()
  async findAll(@Query() query: GetTokenEventsQueryDto) {
    return this.tokenEventsService.findAll(query);
  }

  @Get(':tokenEventId')
  async findOne(
    @Param(
      'tokenEventId',
      new ParseUUIDPipe({
        version: '4',
      }),
    )
    tokenEventId: string,
    @Query() query: GetTokenEventDetailQueryDto,
  ) {
    return this.tokenEventsService.findOne(tokenEventId, query);
  }
}
