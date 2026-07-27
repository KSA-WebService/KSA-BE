import { ConflictException, Injectable } from '@nestjs/common';
import { AdminAction, AdminActionType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWhitelistUserDto } from './dto/create-whitelist-user.dto';

@Injectable()
export class WhitelistUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createWhitelistUserDto: CreateWhitelistUserDto,
    adminId: string,
  ) {
    const { name, studentNumber, email } = createWhitelistUserDto;

    const existingWhitelistUser = await this.prisma.whitelistedUser.findFirst({
      where: {
        OR: [
          {
            email,
          },
          {
            studentNumber,
          },
        ],
      },
      select: {
        email: true,
        studentNumber: true,
      },
    });

    if (existingWhitelistUser?.email === email) {
      throw new ConflictException({
        errorCode: 'W409_EMAIL',
        message: 'The email is already registered in the whitelist',
        data: {
          email,
        },
      });
    }

    if (existingWhitelistUser?.studentNumber === studentNumber) {
      throw new ConflictException({
        errorCode: 'W409_STUDENT_NUMBER',
        message: 'The student number is already registered in the whitelist',
        data: {
          studentNumber,
        },
      });
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email,
          },
          {
            studentNumber,
          },
        ],
      },
      select: {
        email: true,
        studentNumber: true,
      },
    });

    if (existingUser?.email === email) {
      throw new ConflictException({
        errorCode: 'U409_EMAIL',
        message: 'A user with this email is already registered',
        data: {
          email,
        },
      });
    }

    if (existingUser?.studentNumber === studentNumber) {
      throw new ConflictException({
        errorCode: 'U409_STUDENT_NUMBER',
        message: 'A user with this student number is already registered',
        data: {
          studentNumber,
        },
      });
    }

    try {
      const createdWhitelistUser = await this.prisma.$transaction(
        async (transaction) => {
          const whitelistUser = await transaction.whitelistedUser.create({
            data: {
              name,
              studentNumber,
              email,
            },
            select: {
              id: true,
              name: true,
              studentNumber: true,
              email: true,
              invitationStatus: true,
              invitedAt: true,
              acceptedAt: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          await transaction.adminActionLog.create({
            data: {
              adminId,
              actionType: AdminActionType.WHITELIST,
              action: AdminAction.CREATE_WHITELIST_USER,
              targetId: whitelistUser.id,
              metadata: {
                name,
                studentNumber,
                email,
              },
            },
          });

          return whitelistUser;
        },
      );

      return {
        whitelistUserId: createdWhitelistUser.id,
        name: createdWhitelistUser.name,
        studentNumber: createdWhitelistUser.studentNumber,
        email: createdWhitelistUser.email,
        invitationStatus: createdWhitelistUser.invitationStatus,
        invitedAt: createdWhitelistUser.invitedAt,
        acceptedAt: createdWhitelistUser.acceptedAt,
        createdAt: createdWhitelistUser.createdAt,
        updatedAt: createdWhitelistUser.updatedAt,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          errorCode: 'W409',
          message:
            'The email or student number is already registered in the whitelist',
        });
      }

      throw error;
    }
  }
}
