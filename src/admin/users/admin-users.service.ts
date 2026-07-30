import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { GetAdminUsersQueryDto } from './dto/get-admin-users-query.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetAdminUsersQueryDto) {
    const { page, limit, keyword, role, status, sort, order } = query;

    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(role
        ? {
            role,
          }
        : {}),
      ...(status
        ? {
            status,
          }
        : {}),
      ...(keyword
        ? {
            OR: [
              {
                name: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
              {
                email: {
                  contains: keyword,
                  mode: 'insensitive',
                },
              },
              {
                studentNumber: {
                  contains: keyword,
                },
              },
            ],
          }
        : {}),
    };

    const primaryOrderBy = {
      [sort]: order,
    } as Prisma.UserOrderByWithRelationInput;

    const [users, totalCount] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          primaryOrderBy,
          {
            id: order,
          },
        ],
        select: {
          id: true,
          name: true,
          studentNumber: true,
          email: true,
          role: true,
          tokenBalance: true,
          status: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({
        where,
      }),
    ]);

    return {
      items: users.map((user) => ({
        userId: user.id,
        name: user.name,
        studentNumber: user.studentNumber,
        email: user.email,
        role: user.role,
        tokenBalance: user.tokenBalance,
        status: user.status,
        createdAt: user.createdAt,
      })),
      page,
      limit,
      totalCount,
      totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
    };
  }
}
