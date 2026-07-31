import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedRequest = Request & {
  user?: {
    id: string;
  };
};

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        errorCode: 'A401',
        message: 'Access token is required',
      });
    }

    const token = authHeader.slice('Bearer '.length).trim();

    if (!token) {
      throw new UnauthorizedException({
        errorCode: 'A401',
        message: 'Access token is required',
      });
    }

    const supabase = createClient(
      this.configService.getOrThrow<string>('SUPABASE_URL'),
      this.configService.getOrThrow<string>('SUPABASE_ANON_KEY'),
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new UnauthorizedException({
        errorCode: 'A401',
        message: error?.message ?? 'Invalid access token',
        data: {
          status: error?.status,
          name: error?.name,
        },
      });
    }

    const ksaUser = await this.prisma.user.findUnique({
      where: {
        id: user.id,
      },
      select: {
        status: true,
        deletedAt: true,
      },
    });

    const hasActiveUserAccess =
      ksaUser !== null &&
      ksaUser.status === UserStatus.ACTIVE &&
      ksaUser.deletedAt === null;

    if (!hasActiveUserAccess) {
      throw new ForbiddenException({
        errorCode: 'A403',
        message: 'Active user access is required',
      });
    }

    request.user = user;

    return true;
  }
}
