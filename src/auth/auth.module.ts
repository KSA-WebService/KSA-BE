import { Module } from '@nestjs/common';
import { InvitationVerificationModule } from './invitations/invitation-verification.module';
import { OnboardingModule } from './onboarding/onboarding.module';

@Module({
  imports: [InvitationVerificationModule, OnboardingModule],
})
export class AuthModule {}
