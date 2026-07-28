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
import { SupabaseAuthGuard } from '../../../auth/supabase-auth.guard';
import { AdminGuard } from '../../../auth/admin.guard';
import { InvitationsService } from './invitations.service';
import {
  ResendInvitationsResponse,
  SendInvitationsDto,
  SendInvitationsResponse,
} from './dto/send-invitations.dto';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller('admin/auth/invitations')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class InvitationsController {
  constructor(private readonly invitationsService: InvitationsService) {}

  @Post('send')
  @HttpCode(HttpStatus.OK)
  async send(
    @Body() dto: SendInvitationsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<SendInvitationsResponse> {
    return this.invitationsService.send(dto, request.user.id);
  }

  @Post('resend')
  @HttpCode(HttpStatus.OK)
  async resend(
    @Body() dto: SendInvitationsDto,
    @Req() request: AuthenticatedRequest,
  ): Promise<ResendInvitationsResponse> {
    return this.invitationsService.resend(dto, request.user.id);
  }
}
