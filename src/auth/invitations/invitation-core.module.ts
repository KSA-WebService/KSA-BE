import { Module } from '@nestjs/common';
import { InvitationEligibilityService } from './invitation-eligibility.service';

@Module({
  providers: [InvitationEligibilityService],
  exports: [InvitationEligibilityService],
})
export class InvitationCoreModule {}
