import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  VerifyInvitationDto,
  VerifyInvitationResponse,
} from './dto/verify-invitation.dto';
import { InvitationVerificationService } from './invitation-verification.service';

@Controller('auth/invitations')
export class InvitationVerificationController {
  constructor(
    private readonly invitationVerificationService: InvitationVerificationService,
  ) {}

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  async verify(
    @Body() dto: VerifyInvitationDto,
  ): Promise<VerifyInvitationResponse> {
    return this.invitationVerificationService.verify(dto);
  }
}
