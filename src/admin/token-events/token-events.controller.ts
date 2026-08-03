import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { SaveTokenGrantsDto } from './dto/save-token-grants.dto';
import { UpdateTokenEventDto } from './dto/update-token-event.dto';

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

  @Patch(':tokenEventId')
  async updateTokenEvent(
    @Param('tokenEventId', new ParseUUIDPipe({ version: '4' }))
    tokenEventId: string,
    @Body() dto: UpdateTokenEventDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tokenEventsService.updateTokenEvent(
      tokenEventId,
      dto,
      request.user.id,
    );
  }

  @Patch(':tokenEventId/grants')
  async saveGrants(
    @Param('tokenEventId', new ParseUUIDPipe({ version: '4' }))
    tokenEventId: string,
    @Body() body: SaveTokenGrantsDto,
    @Req() request: { user: { id: string } },
  ) {
    return this.tokenEventsService.saveGrants(
      tokenEventId,
      request.user.id,
      body,
    );
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

  @Delete(':tokenEventId')
  async deleteTokenEvent(
    @Param('tokenEventId', new ParseUUIDPipe({ version: '4' }))
    tokenEventId: string,
    @Req() request: { user: { id: string } },
  ) {
    return this.tokenEventsService.deleteTokenEvent(
      tokenEventId,
      request.user.id,
    );
  }
}
