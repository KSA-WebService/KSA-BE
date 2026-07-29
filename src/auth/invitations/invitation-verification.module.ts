import { Module } from '@nestjs/common';
import { InvitationCoreModule } from './invitation-core.module';
import { InvitationVerificationController } from './invitation-verification.controller';
import { InvitationVerificationService } from './invitation-verification.service';

@Module({
  imports: [InvitationCoreModule],
  controllers: [InvitationVerificationController],
  providers: [InvitationVerificationService],
})
export class InvitationVerificationModule {}
