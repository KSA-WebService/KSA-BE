import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  USER_ROLE_VALUE_MAP,
  USER_STATUS_VALUE_MAP,
} from '../../common/constants/user-api-values';

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
        errorCode: 'A403_ADMIN_ACCESS_REQUIRED',
        message: 'Active admin access is required',
      });
    }

    return {
      userId: admin.id,
      name: admin.name,
      email: admin.email,
      role: USER_ROLE_VALUE_MAP[admin.role],
      status: USER_STATUS_VALUE_MAP[admin.status],
    };
  }
}
