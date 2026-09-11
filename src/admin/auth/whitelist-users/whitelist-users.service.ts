import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  InvitationLinkStatus,
  Prisma,
  WhitelistInvitationStatus,
} from '@prisma/client';
import {
  INVITATION_LINK_STATUS_VALUE_MAP,
  WHITELIST_INVITATION_STATUS_PRISMA_MAP,
  WHITELIST_INVITATION_STATUS_VALUE_MAP,
} from '../../../common/constants/invitation-api-values';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateWhitelistUserDto } from './dto/create-whitelist-user.dto';
import { UpdateWhitelistUserDto } from './dto/update-whitelist-user.dto';
import {
  GetWhitelistUsersQueryDto,
  WhitelistUserSortField,
} from './dto/get-whitelist-users-query.dto';
import { isEmail } from 'class-validator';
import {
  ImportRowResult,
  ImportRowStatusValue,
  ImportWhitelistUsersDto,
  ImportWhitelistUsersResponse,
  WhitelistImportDuplicatePolicy,
} from './dto/import-whitelist-users.dto';

interface NormalizedImportUser {
  rowIndex: number;
  name: string;
  studentNumber: string;
  email: string;
}
interface ImportRowValidation {
  row: NormalizedImportUser | null;
  email: string;
  studentNumber: string;
  errorMessage: string | null;
}

type WhitelistUserCreateResult = Prisma.WhitelistedUserGetPayload<{
  select: {
    id: true;
    name: true;
    studentNumber: true;
    email: true;
    invitationStatus: true;
    invitedAt: true;
    acceptedAt: true;
    createdAt: true;
    updatedAt: true;
  };
}>;

type ImportAction =
  | {
      type: 'CREATE';
      row: NormalizedImportUser;
      resultIndex: number;
    }
  | {
      type: 'UPDATE';
      row: NormalizedImportUser;
      resultIndex: number;
      whitelistUserId: string;
      restore: boolean;
    };

const WHITELIST_USER_SORT_PRISMA_FIELD_MAP: Record<
  WhitelistUserSortField,
  | 'name'
  | 'studentNumber'
  | 'email'
  | 'invitationStatus'
  | 'invitedAt'
  | 'createdAt'
> = {
  [WhitelistUserSortField.NAME]: 'name',
  [WhitelistUserSortField.STUDENT_NUMBER]: 'studentNumber',
  [WhitelistUserSortField.EMAIL]: 'email',
  [WhitelistUserSortField.INVITATION_STATUS]: 'invitationStatus',
  [WhitelistUserSortField.INVITED_AT]: 'invitedAt',
  [WhitelistUserSortField.CREATED_AT]: 'createdAt',
};
@Injectable()
export class WhitelistUsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: GetWhitelistUsersQueryDto) {
    const { page, limit, keyword, invitationStatus, sort, order } = query;

    const skip = (page - 1) * limit;

    const prismaInvitationStatus = invitationStatus
      ? WHITELIST_INVITATION_STATUS_PRISMA_MAP[invitationStatus]
      : undefined;

    const where: Prisma.WhitelistedUserWhereInput = {
      deletedAt: null,
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
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
      ...(prismaInvitationStatus
        ? {
            invitationStatus: prismaInvitationStatus,
          }
        : {}),
    };

    const primaryOrderBy = {
      [WHITELIST_USER_SORT_PRISMA_FIELD_MAP[sort]]: order,
    } as Prisma.WhitelistedUserOrderByWithRelationInput;

    const [whitelistUsers, totalCount] = await this.prisma.$transaction([
      this.prisma.whitelistedUser.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          primaryOrderBy,
          {
            id: 'asc',
          },
        ],
        select: {
          id: true,
          name: true,
          studentNumber: true,
          email: true,
          invitationStatus: true,
          invitedAt: true,
          createdAt: true,
        },
      }),
      this.prisma.whitelistedUser.count({
        where,
      }),
    ]);

    return {
      items: whitelistUsers.map((whitelistUser) => ({
        whitelistUserId: whitelistUser.id,
        name: whitelistUser.name,
        studentNumber: whitelistUser.studentNumber,
        email: whitelistUser.email,
        invitationStatus:
          WHITELIST_INVITATION_STATUS_VALUE_MAP[whitelistUser.invitationStatus],
        invitedAt: whitelistUser.invitedAt,
        createdAt: whitelistUser.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / limit),
      },
    };
  }

  async findOne(whitelistUserId: string) {
    const whitelistUser = await this.prisma.whitelistedUser.findFirst({
      where: {
        id: whitelistUserId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        studentNumber: true,
        email: true,
        invitationStatus: true,
        userId: true,
        invitedAt: true,
        acceptedAt: true,
        createdAt: true,
        updatedAt: true,
        inviter: {
          select: {
            id: true,
            name: true,
          },
        },
        invitations: {
          orderBy: [
            {
              sentAt: 'desc',
            },
            {
              createdAt: 'desc',
            },
          ],
          take: 1,
          select: {
            id: true,
            linkStatus: true,
            sentAt: true,
            expiresAt: true,
            acceptedAt: true,
          },
        },
      },
    });

    if (!whitelistUser) {
      throw new NotFoundException({
        errorCode: 'W404_WHITELIST_USER_NOT_FOUND',
        message: 'Whitelist user not found',
        data: {
          whitelistUserId,
        },
      });
    }

    const latestInvitation = whitelistUser.invitations[0] ?? null;

    return {
      whitelistUserId: whitelistUser.id,
      name: whitelistUser.name,
      studentNumber: whitelistUser.studentNumber,
      email: whitelistUser.email,
      invitationStatus:
        WHITELIST_INVITATION_STATUS_VALUE_MAP[whitelistUser.invitationStatus],
      userId: whitelistUser.userId,
      invitedBy: whitelistUser.inviter
        ? {
            userId: whitelistUser.inviter.id,
            name: whitelistUser.inviter.name,
          }
        : null,
      invitedAt: whitelistUser.invitedAt,
      acceptedAt: whitelistUser.acceptedAt,
      createdAt: whitelistUser.createdAt,
      updatedAt: whitelistUser.updatedAt,
      latestInvitation: latestInvitation
        ? {
            invitationId: latestInvitation.id,
            linkStatus:
              INVITATION_LINK_STATUS_VALUE_MAP[latestInvitation.linkStatus],
            sentAt: latestInvitation.sentAt,
            expiresAt: latestInvitation.expiresAt,
            acceptedAt: latestInvitation.acceptedAt,
          }
        : null,
    };
  }

  async update(
    whitelistUserId: string,
    dto: UpdateWhitelistUserDto,
    adminId: string,
  ) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const whitelistUser = await tx.whitelistedUser.findFirst({
          where: {
            id: whitelistUserId,
            deletedAt: null,
          },
          select: {
            id: true,
            name: true,
            studentNumber: true,
            email: true,
            invitationStatus: true,
            userId: true,
            invitedAt: true,
            acceptedAt: true,
            updatedAt: true,
          },
        });

        if (!whitelistUser) {
          throw new NotFoundException({
            errorCode: 'W404_WHITELIST_USER_NOT_FOUND',
            message: 'Whitelist user not found',
            data: {
              whitelistUserId,
            },
          });
        }

        if (
          whitelistUser.invitationStatus ===
            WhitelistInvitationStatus.ACCEPTED ||
          whitelistUser.userId !== null
        ) {
          throw new ConflictException({
            errorCode: 'W409_WHITELIST_USER_NOT_EDITABLE',
            message:
              'A registered or accepted whitelist user cannot be corrected through this endpoint',
            data: {
              whitelistUserId,
            },
          });
        }

        const nextName = dto.name ?? whitelistUser.name;
        const nextStudentNumber =
          dto.studentNumber ?? whitelistUser.studentNumber;
        const nextEmail = dto.email ?? whitelistUser.email;

        const nameChanged = nextName !== whitelistUser.name;
        const studentNumberChanged =
          nextStudentNumber !== whitelistUser.studentNumber;
        const emailChanged = nextEmail !== whitelistUser.email;

        if (!nameChanged && !studentNumberChanged && !emailChanged) {
          throw new BadRequestException({
            errorCode: 'W400_NO_CHANGES',
            message: 'At least one whitelist identity field must be changed',
            data: {
              whitelistUserId,
            },
          });
        }

        if (emailChanged) {
          const existingWhitelistByEmail = await tx.whitelistedUser.findFirst({
            where: {
              id: {
                not: whitelistUserId,
              },
              email: {
                equals: nextEmail,
                mode: 'insensitive',
              },
            },
            select: {
              id: true,
            },
          });

          if (existingWhitelistByEmail) {
            throw new ConflictException({
              errorCode: 'W409_EMAIL',
              message: 'The email is already registered in the whitelist',
              data: {
                email: nextEmail,
              },
            });
          }

          const existingUserByEmail = await tx.user.findFirst({
            where: {
              email: {
                equals: nextEmail,
                mode: 'insensitive',
              },
            },
            select: {
              id: true,
            },
          });

          if (existingUserByEmail) {
            throw new ConflictException({
              errorCode: 'U409_EMAIL',
              message: 'A user with this email is already registered',
              data: {
                email: nextEmail,
              },
            });
          }
        }

        if (studentNumberChanged) {
          const existingWhitelistByStudentNumber =
            await tx.whitelistedUser.findFirst({
              where: {
                id: {
                  not: whitelistUserId,
                },
                studentNumber: nextStudentNumber,
              },
              select: {
                id: true,
              },
            });

          if (existingWhitelistByStudentNumber) {
            throw new ConflictException({
              errorCode: 'W409_STUDENT_NUMBER',
              message:
                'The student number is already registered in the whitelist',
              data: {
                studentNumber: nextStudentNumber,
              },
            });
          }

          const existingUserByStudentNumber = await tx.user.findFirst({
            where: {
              studentNumber: nextStudentNumber,
            },
            select: {
              id: true,
            },
          });

          if (existingUserByStudentNumber) {
            throw new ConflictException({
              errorCode: 'U409_STUDENT_NUMBER',
              message: 'A user with this student number is already registered',
              data: {
                studentNumber: nextStudentNumber,
              },
            });
          }
        }

        const updateResult = await tx.whitelistedUser.updateMany({
          where: {
            id: whitelistUserId,
            deletedAt: null,
            userId: null,
            invitationStatus: {
              not: WhitelistInvitationStatus.ACCEPTED,
            },
            updatedAt: whitelistUser.updatedAt,
          },
          data: {
            name: nextName,
            studentNumber: nextStudentNumber,
            email: nextEmail,
          },
        });

        if (updateResult.count !== 1) {
          throw new ConflictException({
            errorCode: 'W409_UPDATE_CONFLICT',
            message:
              'The whitelist user could not be updated because its state changed',
            data: {
              whitelistUserId,
            },
          });
        }

        let revokedInvitationCount = 0;

        if (emailChanged) {
          const revokeResult = await tx.invitation.updateMany({
            where: {
              whitelistUserId,
              linkStatus: InvitationLinkStatus.ACTIVE,
            },
            data: {
              linkStatus: InvitationLinkStatus.REVOKED,
            },
          });

          revokedInvitationCount = revokeResult.count;
        }

        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.WHITELIST,
            action: AdminAction.UPDATE_WHITELIST_USER,
            targetId: whitelistUserId,
            metadata: {
              previous: {
                name: whitelistUser.name,
                studentNumber: whitelistUser.studentNumber,
                email: whitelistUser.email,
              },
              updated: {
                name: nextName,
                studentNumber: nextStudentNumber,
                email: nextEmail,
              },
              changedFields: [
                ...(nameChanged ? ['name'] : []),
                ...(studentNumberChanged ? ['studentNumber'] : []),
                ...(emailChanged ? ['email'] : []),
              ],
              reason: dto.reason,
              revokedInvitationCount,
            },
          },
        });

        const updatedWhitelistUser = await tx.whitelistedUser.findUniqueOrThrow(
          {
            where: {
              id: whitelistUserId,
            },
            select: {
              id: true,
              name: true,
              studentNumber: true,
              email: true,
              invitationStatus: true,
              userId: true,
              invitedAt: true,
              acceptedAt: true,
              updatedAt: true,
            },
          },
        );

        return {
          whitelistUserId: updatedWhitelistUser.id,
          name: updatedWhitelistUser.name,
          studentNumber: updatedWhitelistUser.studentNumber,
          email: updatedWhitelistUser.email,
          invitationStatus:
            WHITELIST_INVITATION_STATUS_VALUE_MAP[
              updatedWhitelistUser.invitationStatus
            ],
          userId: updatedWhitelistUser.userId,
          invitedAt: updatedWhitelistUser.invitedAt,
          acceptedAt: updatedWhitelistUser.acceptedAt,
          updatedAt: updatedWhitelistUser.updatedAt,
        };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          errorCode: 'W409_DUPLICATE',
          message:
            'The email or student number is already registered in the whitelist',
          data: null,
        });
      }

      throw error;
    }
  }

  async remove(whitelistUserId: string, adminId: string) {
    return this.prisma.$transaction(async (tx) => {
      const whitelistUser = await tx.whitelistedUser.findFirst({
        where: {
          id: whitelistUserId,
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          studentNumber: true,
          email: true,
          invitationStatus: true,
          userId: true,
        },
      });

      if (!whitelistUser) {
        throw new NotFoundException({
          errorCode: 'W404_WHITELIST_USER_NOT_FOUND',
          message: 'Whitelist user not found',
          data: {
            whitelistUserId,
          },
        });
      }

      if (
        whitelistUser.invitationStatus === WhitelistInvitationStatus.ACCEPTED ||
        whitelistUser.userId !== null
      ) {
        throw new ConflictException({
          errorCode: 'W409_ACCEPTED',
          message: 'An accepted whitelist user cannot be deleted',
          data: {
            whitelistUserId,
          },
        });
      }

      const deletedAt = new Date();

      const softDeleteResult = await tx.whitelistedUser.updateMany({
        where: {
          id: whitelistUserId,
          deletedAt: null,
          userId: null,
          invitationStatus: {
            not: WhitelistInvitationStatus.ACCEPTED,
          },
        },
        data: {
          deletedAt,
        },
      });

      if (softDeleteResult.count !== 1) {
        throw new ConflictException({
          errorCode: 'W409_DELETE_CONFLICT',
          message:
            'Whitelist user could not be deleted because its state changed',
          data: {
            whitelistUserId,
          },
        });
      }

      await tx.invitation.updateMany({
        where: {
          whitelistUserId,
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.REVOKED,
        },
      });

      await tx.adminActionLog.create({
        data: {
          adminId,
          actionType: AdminActionType.WHITELIST,
          action: AdminAction.DELETE_WHITELIST_USER,
          targetId: whitelistUserId,
          metadata: {
            name: whitelistUser.name,
            studentNumber: whitelistUser.studentNumber,
            email: whitelistUser.email,
            invitationStatus: whitelistUser.invitationStatus,
          },
        },
      });

      return {
        deletedWhitelistUserId: whitelistUserId,
      };
    });
  }

  async importUsers(
    dto: ImportWhitelistUsersDto,
    adminId: string,
  ): Promise<ImportWhitelistUsersResponse> {
    const results = new Array<ImportRowResult>(dto.users.length);

    const validRows: NormalizedImportUser[] = [];
    const invalidResults: ImportRowResult[] = [];
    const inputDuplicateResults: ImportRowResult[] = [];

    const seenEmails = new Set<string>();
    const seenStudentNumbers = new Set<string>();

    for (let index = 0; index < dto.users.length; index++) {
      const rowIndex = index + 1;

      const validation = this.validateAndNormalizeImportRow(
        dto.users[index],
        rowIndex,
      );

      if (!validation.row) {
        const result: ImportRowResult = {
          rowIndex,
          email: validation.email,
          studentNumber: validation.studentNumber,
          status: ImportRowStatusValue.FAILED,
          whitelistUserId: null,
          errorMessage: validation.errorMessage,
        };

        results[index] = result;
        invalidResults.push(result);
        continue;
      }

      const row = validation.row;

      const duplicateWithinRequest =
        seenEmails.has(row.email) || seenStudentNumbers.has(row.studentNumber);

      if (duplicateWithinRequest) {
        const status: ImportRowStatusValue =
          dto.onDuplicate === WhitelistImportDuplicatePolicy.SKIP
            ? ImportRowStatusValue.SKIPPED
            : ImportRowStatusValue.FAILED;

        const result: ImportRowResult = {
          rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status,
          whitelistUserId: null,
          errorMessage: 'Duplicate email or student number within the request',
        };

        results[index] = result;

        if (dto.onDuplicate === WhitelistImportDuplicatePolicy.FAIL) {
          inputDuplicateResults.push(result);
        }

        continue;
      }

      seenEmails.add(row.email);
      seenStudentNumbers.add(row.studentNumber);
      validRows.push(row);
    }

    if (
      dto.onDuplicate === WhitelistImportDuplicatePolicy.FAIL &&
      invalidResults.length > 0
    ) {
      throw new BadRequestException({
        errorCode: 'W400_IMPORT_INVALID',
        message: 'Invalid data was found in the whitelist import',
        data: {
          results: invalidResults,
        },
      });
    }

    if (
      dto.onDuplicate === WhitelistImportDuplicatePolicy.FAIL &&
      inputDuplicateResults.length > 0
    ) {
      throw new ConflictException({
        errorCode: 'W409_IMPORT_DUPLICATE',
        message: 'Duplicate data was found in the whitelist import',
        data: {
          results: inputDuplicateResults,
        },
      });
    }

    if (validRows.length === 0) {
      return this.buildImportSummary(results);
    }

    const emails = validRows.map((row) => row.email);
    const studentNumbers = validRows.map((row) => row.studentNumber);

    const [existingWhitelists, existingUsers] = await Promise.all([
      this.prisma.whitelistedUser.findMany({
        where: {
          OR: [
            {
              email: {
                in: emails,
                mode: 'insensitive',
              },
            },
            {
              studentNumber: {
                in: studentNumbers,
              },
            },
          ],
        },
        select: {
          id: true,
          email: true,
          studentNumber: true,
          invitationStatus: true,
          userId: true,
          deletedAt: true,
        },
      }),
      this.prisma.user.findMany({
        where: {
          OR: [
            {
              email: {
                in: emails,
                mode: 'insensitive',
              },
            },
            {
              studentNumber: {
                in: studentNumbers,
              },
            },
          ],
        },
        select: {
          id: true,
          email: true,
          studentNumber: true,
        },
      }),
    ]);

    const whitelistByEmail = new Map(
      existingWhitelists.map((record) => [record.email.toLowerCase(), record]),
    );

    const whitelistByStudentNumber = new Map(
      existingWhitelists.map((record) => [record.studentNumber, record]),
    );

    const userByEmail = new Map(
      existingUsers.map((record) => [record.email.toLowerCase(), record]),
    );

    const userByStudentNumber = new Map(
      existingUsers.map((record) => [record.studentNumber, record]),
    );

    const actions: ImportAction[] = [];
    const databaseDuplicateResults: ImportRowResult[] = [];
    const targetedWhitelistIds = new Set<string>();

    const updatableStatuses = new Set<WhitelistInvitationStatus>([
      WhitelistInvitationStatus.PENDING,
      WhitelistInvitationStatus.FAILED,
      WhitelistInvitationStatus.EXPIRED,
    ]);

    for (const row of validRows) {
      const resultIndex = row.rowIndex - 1;

      const whitelistByMatchingEmail = whitelistByEmail.get(row.email);

      const whitelistByMatchingStudentNumber = whitelistByStudentNumber.get(
        row.studentNumber,
      );

      const existingUserByEmail = userByEmail.get(row.email);

      const existingUserByStudentNumber = userByStudentNumber.get(
        row.studentNumber,
      );

      const hasExistingUser =
        existingUserByEmail !== undefined ||
        existingUserByStudentNumber !== undefined;

      const hasExistingWhitelist =
        whitelistByMatchingEmail !== undefined ||
        whitelistByMatchingStudentNumber !== undefined;

      const conflictingWhitelistMatches =
        whitelistByMatchingEmail !== undefined &&
        whitelistByMatchingStudentNumber !== undefined &&
        whitelistByMatchingEmail.id !== whitelistByMatchingStudentNumber.id;

      const exactWhitelistMatch =
        whitelistByMatchingEmail !== undefined &&
        whitelistByMatchingStudentNumber !== undefined &&
        whitelistByMatchingEmail.id === whitelistByMatchingStudentNumber.id;

      const exactDeletedWhitelist =
        exactWhitelistMatch && whitelistByMatchingEmail.deletedAt !== null
          ? whitelistByMatchingEmail
          : null;

      if (dto.onDuplicate === WhitelistImportDuplicatePolicy.FAIL) {
        if (hasExistingUser || hasExistingWhitelist) {
          const result: ImportRowResult = {
            rowIndex: row.rowIndex,
            email: row.email,
            studentNumber: row.studentNumber,
            status: ImportRowStatusValue.FAILED,
            whitelistUserId: null,
            errorMessage: 'Email or student number already exists',
          };

          results[resultIndex] = result;
          databaseDuplicateResults.push(result);
          continue;
        }

        results[resultIndex] = {
          rowIndex: row.rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status: ImportRowStatusValue.CREATED,
          whitelistUserId: null,
          errorMessage: null,
        };

        actions.push({
          type: 'CREATE',
          row,
          resultIndex,
        });

        continue;
      }

      if (dto.onDuplicate === WhitelistImportDuplicatePolicy.SKIP) {
        if (hasExistingUser || hasExistingWhitelist) {
          let existingWhitelistId: string | null = null;

          if (!conflictingWhitelistMatches) {
            existingWhitelistId =
              whitelistByMatchingEmail?.id ??
              whitelistByMatchingStudentNumber?.id ??
              null;
          }

          results[resultIndex] = {
            rowIndex: row.rowIndex,
            email: row.email,
            studentNumber: row.studentNumber,
            status: ImportRowStatusValue.SKIPPED,
            whitelistUserId: existingWhitelistId,
            errorMessage: hasExistingUser
              ? 'Email or student number already belongs to an existing user'
              : 'Email or student number already exists in the whitelist',
          };

          continue;
        }

        results[resultIndex] = {
          rowIndex: row.rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status: ImportRowStatusValue.CREATED,
          whitelistUserId: null,
          errorMessage: null,
        };

        actions.push({
          type: 'CREATE',
          row,
          resultIndex,
        });

        continue;
      }

      if (hasExistingUser) {
        results[resultIndex] = {
          rowIndex: row.rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status: ImportRowStatusValue.FAILED,
          whitelistUserId: null,
          errorMessage:
            'Email or student number already belongs to an existing user',
        };

        continue;
      }

      if (conflictingWhitelistMatches) {
        results[resultIndex] = {
          rowIndex: row.rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status: ImportRowStatusValue.FAILED,
          whitelistUserId: null,
          errorMessage:
            'Email and student number match different whitelist users',
        };

        continue;
      }

      const matchedWhitelist =
        whitelistByMatchingEmail ?? whitelistByMatchingStudentNumber;

      if (!matchedWhitelist) {
        results[resultIndex] = {
          rowIndex: row.rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status: ImportRowStatusValue.CREATED,
          whitelistUserId: null,
          errorMessage: null,
        };

        actions.push({
          type: 'CREATE',
          row,
          resultIndex,
        });

        continue;
      }

      if (targetedWhitelistIds.has(matchedWhitelist.id)) {
        results[resultIndex] = {
          rowIndex: row.rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status: ImportRowStatusValue.FAILED,
          whitelistUserId: null,
          errorMessage: 'Multiple rows target the same whitelist user',
        };

        continue;
      }

      if (matchedWhitelist.deletedAt !== null) {
        if (
          exactDeletedWhitelist === null ||
          matchedWhitelist.userId !== null ||
          matchedWhitelist.invitationStatus ===
            WhitelistInvitationStatus.ACCEPTED
        ) {
          results[resultIndex] = {
            rowIndex: row.rowIndex,
            email: row.email,
            studentNumber: row.studentNumber,
            status: ImportRowStatusValue.FAILED,
            whitelistUserId: null,
            errorMessage:
              'The deleted whitelist user can only be restored when both email and student number match',
          };

          continue;
        }
      } else if (
        matchedWhitelist.userId !== null ||
        !updatableStatuses.has(matchedWhitelist.invitationStatus)
      ) {
        results[resultIndex] = {
          rowIndex: row.rowIndex,
          email: row.email,
          studentNumber: row.studentNumber,
          status: ImportRowStatusValue.FAILED,
          whitelistUserId: null,
          errorMessage:
            'This whitelist user cannot be updated in the current status',
        };

        continue;
      }

      targetedWhitelistIds.add(matchedWhitelist.id);

      results[resultIndex] = {
        rowIndex: row.rowIndex,
        email: row.email,
        studentNumber: row.studentNumber,
        status: ImportRowStatusValue.UPDATED,
        whitelistUserId: matchedWhitelist.id,
        errorMessage: null,
      };

      actions.push({
        type: 'UPDATE',
        row,
        resultIndex,
        whitelistUserId: matchedWhitelist.id,
        restore: exactDeletedWhitelist !== null,
      });
    }

    if (
      dto.onDuplicate === WhitelistImportDuplicatePolicy.FAIL &&
      databaseDuplicateResults.length > 0
    ) {
      throw new ConflictException({
        errorCode: 'W409_IMPORT_DUPLICATE',
        message: 'Duplicate data was found in the whitelist import',
        data: {
          results: databaseDuplicateResults,
        },
      });
    }

    if (actions.length === 0) {
      return this.buildImportSummary(results);
    }

    try {
      await this.prisma.$transaction(
        async (tx) => {
          for (const action of actions) {
            if (action.type === 'CREATE') {
              const created = await tx.whitelistedUser.create({
                data: {
                  name: action.row.name,
                  studentNumber: action.row.studentNumber,
                  email: action.row.email,
                },
                select: {
                  id: true,
                },
              });

              results[action.resultIndex].whitelistUserId = created.id;

              continue;
            }

            if (action.restore) {
              const restoreResult = await tx.whitelistedUser.updateMany({
                where: {
                  id: action.whitelistUserId,
                  deletedAt: {
                    not: null,
                  },
                  userId: null,
                  invitationStatus: {
                    not: WhitelistInvitationStatus.ACCEPTED,
                  },
                },
                data: {
                  name: action.row.name,
                  studentNumber: action.row.studentNumber,
                  email: action.row.email,
                  deletedAt: null,
                  invitationStatus: WhitelistInvitationStatus.PENDING,
                  invitedBy: null,
                  invitedAt: null,
                  acceptedAt: null,
                },
              });

              if (restoreResult.count !== 1) {
                throw new ConflictException({
                  errorCode: 'W409_IMPORT_RESTORE_CONFLICT',
                  message:
                    'The deleted whitelist user could not be restored because its state changed',
                  data: {
                    whitelistUserId: action.whitelistUserId,
                  },
                });
              }

              results[action.resultIndex].whitelistUserId =
                action.whitelistUserId;

              continue;
            }

            const updateResult = await tx.whitelistedUser.updateMany({
              where: {
                id: action.whitelistUserId,
                deletedAt: null,
                userId: null,
                invitationStatus: {
                  in: [
                    WhitelistInvitationStatus.PENDING,
                    WhitelistInvitationStatus.FAILED,
                    WhitelistInvitationStatus.EXPIRED,
                  ],
                },
              },
              data: {
                name: action.row.name,
                studentNumber: action.row.studentNumber,
                email: action.row.email,
              },
            });

            if (updateResult.count !== 1) {
              throw new ConflictException({
                errorCode: 'W409_IMPORT_UPDATE_CONFLICT',
                message:
                  'The whitelist user could not be updated because its state changed',
                data: {
                  whitelistUserId: action.whitelistUserId,
                },
              });
            }

            results[action.resultIndex].whitelistUserId =
              action.whitelistUserId;
          }

          const summary = this.buildImportSummary(results);

          await tx.adminActionLog.create({
            data: {
              adminId,
              actionType: AdminActionType.WHITELIST,
              action: AdminAction.IMPORT_WHITELIST_USERS,
              targetId: null,
              metadata: {
                onDuplicate: dto.onDuplicate.toUpperCase(),
                totalCount: summary.totalCount,
                successCount: summary.successCount,
                skippedCount: summary.skippedCount,
                failedCount: summary.failedCount,
              },
            },
          });
        },
        {
          timeout: 15000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          errorCode: 'W409_IMPORT_DUPLICATE',
          message:
            'Duplicate data was detected while processing the whitelist import',
          data: null,
        });
      }

      throw error;
    }

    return this.buildImportSummary(results);
  }

  async create(
    createWhitelistUserDto: CreateWhitelistUserDto,
    adminId: string,
  ) {
    const { name, studentNumber, email } = createWhitelistUserDto;

    const existingWhitelistUsers = await this.prisma.whitelistedUser.findMany({
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
        id: true,
        email: true,
        studentNumber: true,
        deletedAt: true,
        invitationStatus: true,
        userId: true,
      },
    });

    const whitelistByEmail = existingWhitelistUsers.find(
      (whitelistUser) => whitelistUser.email === email,
    );

    const whitelistByStudentNumber = existingWhitelistUsers.find(
      (whitelistUser) => whitelistUser.studentNumber === studentNumber,
    );

    const exactDeletedWhitelist =
      whitelistByEmail &&
      whitelistByStudentNumber &&
      whitelistByEmail.id === whitelistByStudentNumber.id &&
      whitelistByEmail.deletedAt !== null
        ? whitelistByEmail
        : null;

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

    if (!exactDeletedWhitelist) {
      if (whitelistByEmail) {
        throw new ConflictException({
          errorCode: 'W409_EMAIL',
          message: 'The email is already registered in the whitelist',
          data: {
            email,
          },
        });
      }

      if (whitelistByStudentNumber) {
        throw new ConflictException({
          errorCode: 'W409_STUDENT_NUMBER',
          message: 'The student number is already registered in the whitelist',
          data: {
            studentNumber,
          },
        });
      }
    }

    try {
      const createdWhitelistUser = await this.prisma.$transaction(
        async (transaction) => {
          let whitelistUser: WhitelistUserCreateResult;

          if (exactDeletedWhitelist) {
            const restoreResult = await transaction.whitelistedUser.updateMany({
              where: {
                id: exactDeletedWhitelist.id,
                deletedAt: {
                  not: null,
                },
                userId: null,
              },
              data: {
                name,
                deletedAt: null,
                invitationStatus: WhitelistInvitationStatus.PENDING,
                invitedBy: null,
                invitedAt: null,
                acceptedAt: null,
              },
            });

            if (restoreResult.count !== 1) {
              throw new ConflictException({
                errorCode: 'W409_RESTORE_CONFLICT',
                message: 'The deleted whitelist user could not be restored',
                data: {
                  email,
                  studentNumber,
                },
              });
            }

            const restoredWhitelistUser =
              await transaction.whitelistedUser.findUniqueOrThrow({
                where: {
                  id: exactDeletedWhitelist.id,
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

            whitelistUser = restoredWhitelistUser;
          } else {
            whitelistUser = await transaction.whitelistedUser.create({
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
          }

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
                restored: exactDeletedWhitelist !== null,
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
        invitationStatus:
          WHITELIST_INVITATION_STATUS_VALUE_MAP[
            createdWhitelistUser.invitationStatus
          ],
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
          errorCode: 'W409_DUPLICATE',
          message:
            'The email or student number is already registered in the whitelist',
        });
      }

      throw error;
    }
  }

  private validateAndNormalizeImportRow(
    raw: unknown,
    rowIndex: number,
  ): ImportRowValidation {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
      return {
        row: null,
        email: '',
        studentNumber: '',
        errorMessage: 'Each user must be an object',
      };
    }

    const record = raw as Record<string, unknown>;

    const name = typeof record.name === 'string' ? record.name.trim() : '';

    const studentNumber =
      typeof record.studentNumber === 'string'
        ? record.studentNumber.trim()
        : '';

    const email =
      typeof record.email === 'string' ? record.email.trim().toLowerCase() : '';

    const allowedFields = new Set(['name', 'studentNumber', 'email']);

    const unknownFields = Object.keys(record).filter(
      (key) => !allowedFields.has(key),
    );

    if (unknownFields.length > 0) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: `Unknown field(s): ${unknownFields.join(', ')}`,
      };
    }

    if (!name) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Name is required',
      };
    }

    if (name.length > 128) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Name must not exceed 128 characters',
      };
    }

    if (!studentNumber) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Student number is required',
      };
    }

    if (studentNumber.length > 36) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Student number must not exceed 36 characters',
      };
    }

    if (!email) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Email is required',
      };
    }

    if (email.length > 255) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Email must not exceed 255 characters',
      };
    }

    if (!isEmail(email)) {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Invalid email format',
      };
    }

    const emailDomain = email.split('@')[1];

    if (emailDomain !== 'connect.ust.hk') {
      return {
        row: null,
        email,
        studentNumber,
        errorMessage: 'Email must use the @connect.ust.hk domain',
      };
    }

    return {
      row: {
        rowIndex,
        name,
        studentNumber,
        email,
      },
      email,
      studentNumber,
      errorMessage: null,
    };
  }

  private buildImportSummary(
    results: ImportRowResult[],
  ): ImportWhitelistUsersResponse {
    const successCount = results.filter(
      (result) =>
        result.status === ImportRowStatusValue.CREATED ||
        result.status === ImportRowStatusValue.UPDATED,
    ).length;

    const skippedCount = results.filter(
      (result) => result.status === ImportRowStatusValue.SKIPPED,
    ).length;

    const failedCount = results.filter(
      (result) => result.status === ImportRowStatusValue.FAILED,
    ).length;

    return {
      totalCount: results.length,
      successCount,
      skippedCount,
      failedCount,
      results,
    };
  }
}
