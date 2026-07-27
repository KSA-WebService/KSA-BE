import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

type AuthenticatedRequest = Request & {
  user?: {
    id?: string;
  };
};

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    const authenticatedUserId = request.user?.id;

    if (!authenticatedUserId) {
      throw new UnauthorizedException({
        errorCode: 'A401',
        message: 'Authenticated user information is missing',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: {
        id: authenticatedUserId,
      },
      select: {
        role: true,
      },
    });

    if (!user || user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        errorCode: 'A403',
        message: 'Admin access is required',
      });
    }

    return true;
  }
}
