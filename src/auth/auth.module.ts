import { Module } from '@nestjs/common';
import { InvitationVerificationModule } from './invitaions/invitation-verification.module';

@Module({
  imports: [InvitationVerificationModule],
})
export class AuthModule {}
