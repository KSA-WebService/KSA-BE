import { Module } from '@nestjs/common';
import { InvitationVerificationController } from './invitation-verification.controller';
import { InvitationVerificationService } from './invitation-verification.service';

@Module({
  controllers: [InvitationVerificationController],
  providers: [InvitationVerificationService],
})
export class InvitationVerificationModule {}
