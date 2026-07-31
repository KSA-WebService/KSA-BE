import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WhitelistUsersModule } from './admin/auth/whitelist-users/whitelist-users.module';
import { InvitationsModule } from './admin/auth/invitations/invitations.module';
import { AdminProfileModule } from './admin/profile/admin-profile.module';
import { AdminUsersModule } from './admin/users/admin-users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    HealthModule,
    PrismaModule,
    UsersModule,
    AuthModule,
    WhitelistUsersModule,
    InvitationsModule,
    AdminUsersModule,
    AdminProfileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
