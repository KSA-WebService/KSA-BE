import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        studentNumber: true,
        email: true,
        role: true,
        tokenBalance: true,
        status: true,
        agreedPrivacy: true,
        agreedAt: true,
      },
    });

    if (!user) {
      throw new ForbiddenException({
        errorCode: 'A403',
        message: 'Active user access is required',
      });
    }

    return {
      userId: user.id,
      name: user.name,
      studentNumber: user.studentNumber,
      email: user.email,
      role: user.role,
      tokenBalance: user.tokenBalance,
      status: user.status,
      agreedPrivacy: user.agreedPrivacy,
      agreedAt: user.agreedAt,
    };
  }
}
