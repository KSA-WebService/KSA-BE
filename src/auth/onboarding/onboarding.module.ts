import { Module } from '@nestjs/common';
import { InvitationCoreModule } from '../invitations/invitation-core.module';
import { SupabaseAdminService } from '../supabase-admin.service';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  imports: [InvitationCoreModule],
  controllers: [OnboardingController],
  providers: [OnboardingService, SupabaseAdminService],
})
export class OnboardingModule {}
