import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        studentNumber: true,
        role: true,
        status: true,
        tokenBalance: true,
        agreedPrivacy: true,
        agreedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException({
        errorCode: 'U404',
        message: 'User profile not found',
        data: { userId },
      });
    }

    return user;
  }
}
