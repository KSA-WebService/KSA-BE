import { Module } from '@nestjs/common';
import { AdminGuard } from '../../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../../auth/supabase-auth.guard';
import { WhitelistUsersController } from './whitelist-users.controller';
import { WhitelistUsersService } from './whitelist-users.service';

@Module({
  controllers: [WhitelistUsersController],
  providers: [WhitelistUsersService, SupabaseAuthGuard, AdminGuard],
})
export class WhitelistUsersModule {}
