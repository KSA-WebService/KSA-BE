import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { WhitelistUsersModule } from './admin/auth/whitelist-users/whitelist-users.module';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
