import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { AdminGuard } from '../../auth/admin.guard';
import { CreateTokenEventDto } from './dto/create-token-event.dto';
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
}
