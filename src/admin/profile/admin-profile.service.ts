import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const admin = await this.prisma.user.findFirst({
      where: {
        id: userId,
        role: UserRole.ADMIN,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!admin) {
      throw new ForbiddenException({
        errorCode: 'A403',
        message: 'Active admin access is required',
      });
    }

    return {
      userId: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      status: admin.status,
    };
  }
}
