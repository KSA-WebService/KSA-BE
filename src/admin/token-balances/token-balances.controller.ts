import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { ResetTokenBalancesDto } from './dto/reset-token-balances.dto';
import { TokenBalancesService } from './token-balances.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

@Controller('admin/token-balances')
@UseGuards(SupabaseAuthGuard, AdminGuard)
export class TokenBalancesController {
  constructor(private readonly tokenBalancesService: TokenBalancesService) {}

  @Get('reset-preview')
  async getResetPreview() {
    return this.tokenBalancesService.getResetPreview();
  }

  @Post('reset')
  async resetTokenBalances(
    @Body() body: ResetTokenBalancesDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.tokenBalancesService.resetTokenBalances(body, request.user.id);
  }
}
