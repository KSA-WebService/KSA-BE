import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  InvitationLinkStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import { WhitelistUsersService } from './whitelist-users.service';

import {
  ImportRowStatusValue,
  WhitelistImportDuplicatePolicy,
} from './dto/import-whitelist-users.dto';

describe('WhitelistUsersService', () => {
  let service: WhitelistUsersService;

  const whitelistUserFindManyMock = jest.fn();
  const whitelistUserFindFirstMock = jest.fn();
  const userFindFirstMock = jest.fn();
  const userFindManyMock = jest.fn();

  const transactionWhitelistUserFindFirstMock = jest.fn();
  const transactionWhitelistUserUpdateManyMock = jest.fn();
  const transactionWhitelistUserCreateMock = jest.fn();
  const transactionWhitelistUserFindUniqueOrThrowMock = jest.fn();

  const transactionUserFindFirstMock = jest.fn();

  const transactionInvitationUpdateManyMock = jest.fn();
  const transactionAdminActionLogCreateMock = jest.fn();

  const transactionClientMock = {
    whitelistedUser: {
      findFirst: transactionWhitelistUserFindFirstMock,
      updateMany: transactionWhitelistUserUpdateManyMock,
      create: transactionWhitelistUserCreateMock,
      findUniqueOrThrow: transactionWhitelistUserFindUniqueOrThrowMock,
    },
    user: {
      findFirst: transactionUserFindFirstMock,
    },
    invitation: {
      updateMany: transactionInvitationUpdateManyMock,
    },
    adminActionLog: {
      create: transactionAdminActionLogCreateMock,
    },
  };

  const transactionMock = jest.fn();

  const prismaServiceMock = {
    whitelistedUser: {
      findMany: whitelistUserFindManyMock,
      findFirst: whitelistUserFindFirstMock,
    },
    user: {
      findFirst: userFindFirstMock,
      findMany: userFindManyMock,
    },
    $transaction: transactionMock,
  };

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const whitelistUserId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const createdAt = new Date('2026-08-01T03:00:00.000Z');
  const updatedAt = new Date('2026-08-02T03:00:00.000Z');
  const deletedAt = new Date('2026-08-03T03:00:00.000Z');

  const baseWhitelistUser = {
    id: whitelistUserId,
    name: 'HKUST Student',
    studentNumber: '20912345',
    email: 'student@connect.ust.hk',
    invitationStatus: WhitelistInvitationStatus.PENDING,
    userId: null,
  };

  beforeEach(() => {
    jest.resetAllMocks();

    transactionMock.mockImplementation(
      async (
        callback: (tx: typeof transactionClientMock) => Promise<unknown>,
      ) => callback(transactionClientMock),
    );

    service = new WhitelistUsersService(
      prismaServiceMock as unknown as PrismaService,
    );
  });

  describe('findOne', () => {
    it('should return inviter and latest invitation details', async () => {
      const invitedAt = new Date('2026-08-10T03:00:00.000Z');
      const sentAt = new Date('2026-08-10T03:00:00.000Z');
      const expiresAt = new Date('2026-08-11T03:00:00.000Z');

      const invitationId = 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54';

      whitelistUserFindFirstMock.mockResolvedValue({
        id: whitelistUserId,
        name: baseWhitelistUser.name,
        studentNumber: baseWhitelistUser.studentNumber,
        email: baseWhitelistUser.email,
        invitationStatus: WhitelistInvitationStatus.INVITED,
        userId: null,
        invitedAt,
        acceptedAt: null,
        createdAt,
        updatedAt,
        inviter: {
          id: adminId,
          name: 'KSA Administrator',
        },
        invitations: [
          {
            id: invitationId,
            linkStatus: InvitationLinkStatus.ACTIVE,
            sentAt,
            expiresAt,
            acceptedAt: null,
          },
        ],
      });

      await expect(service.findOne(whitelistUserId)).resolves.toEqual({
        whitelistUserId,
        name: baseWhitelistUser.name,
        studentNumber: baseWhitelistUser.studentNumber,
        email: baseWhitelistUser.email,
        invitationStatus: 'invited',
        userId: null,
        invitedBy: {
          userId: adminId,
          name: 'KSA Administrator',
        },
        invitedAt,
        acceptedAt: null,
        createdAt,
        updatedAt,
        latestInvitation: {
          invitationId,
          linkStatus: 'active',
          sentAt,
          expiresAt,
          acceptedAt: null,
        },
      });

      expect(whitelistUserFindFirstMock).toHaveBeenCalledWith({
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
    });

    it('should return null inviter and latest invitation when none exist', async () => {
      whitelistUserFindFirstMock.mockResolvedValue({
        id: whitelistUserId,
        name: baseWhitelistUser.name,
        studentNumber: baseWhitelistUser.studentNumber,
        email: baseWhitelistUser.email,
        invitationStatus: WhitelistInvitationStatus.PENDING,
        userId: null,
        invitedAt: null,
        acceptedAt: null,
        createdAt,
        updatedAt,
        inviter: null,
        invitations: [],
      });

      await expect(service.findOne(whitelistUserId)).resolves.toMatchObject({
        whitelistUserId,
        invitationStatus: 'pending',
        invitedBy: null,
        invitedAt: null,
        acceptedAt: null,
        latestInvitation: null,
      });
    });
  });

  describe('update', () => {
    const editableWhitelistUser = {
      ...baseWhitelistUser,
      invitationStatus: WhitelistInvitationStatus.INVITED,
      invitedAt: new Date('2026-08-10T03:00:00.000Z'),
      acceptedAt: null,
      updatedAt,
    };

    it('should update the name of an invited whitelist user without revoking invitations', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue(
        editableWhitelistUser,
      );

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      transactionWhitelistUserFindUniqueOrThrowMock.mockResolvedValue({
        ...editableWhitelistUser,
        name: 'Corrected Student',
      });

      const result = await service.update(
        whitelistUserId,
        {
          name: 'Corrected Student',
          reason: 'Corrected after checking the official student list',
        },
        adminId,
      );

      expect(transactionWhitelistUserUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: whitelistUserId,
          deletedAt: null,
          userId: null,
          invitationStatus: {
            not: WhitelistInvitationStatus.ACCEPTED,
          },
          updatedAt,
        },
        data: {
          name: 'Corrected Student',
          studentNumber: editableWhitelistUser.studentNumber,
          email: editableWhitelistUser.email,
        },
      });

      expect(transactionInvitationUpdateManyMock).not.toHaveBeenCalled();

      expect(transactionAdminActionLogCreateMock).toHaveBeenCalledWith({
        data: {
          adminId,
          actionType: AdminActionType.WHITELIST,
          action: AdminAction.UPDATE_WHITELIST_USER,
          targetId: whitelistUserId,
          metadata: {
            previous: {
              name: editableWhitelistUser.name,
              studentNumber: editableWhitelistUser.studentNumber,
              email: editableWhitelistUser.email,
            },
            updated: {
              name: 'Corrected Student',
              studentNumber: editableWhitelistUser.studentNumber,
              email: editableWhitelistUser.email,
            },
            changedFields: ['name'],
            reason: 'Corrected after checking the official student list',
            revokedInvitationCount: 0,
          },
        },
      });

      expect(result).toEqual({
        whitelistUserId,
        name: 'Corrected Student',
        studentNumber: editableWhitelistUser.studentNumber,
        email: editableWhitelistUser.email,
        invitationStatus: 'invited',
        userId: null,
        invitedAt: editableWhitelistUser.invitedAt,
        acceptedAt: null,
        updatedAt,
      });
    });

    it('should update the email and revoke active invitations', async () => {
      transactionWhitelistUserFindFirstMock
        .mockResolvedValueOnce(editableWhitelistUser)
        .mockResolvedValueOnce(null);

      transactionUserFindFirstMock.mockResolvedValue(null);

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionInvitationUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      const correctedEmail = 'corrected@connect.ust.hk';

      transactionWhitelistUserFindUniqueOrThrowMock.mockResolvedValue({
        ...editableWhitelistUser,
        email: correctedEmail,
      });

      const result = await service.update(
        whitelistUserId,
        {
          email: correctedEmail,
          reason: 'Corrected after student reported a wrong email',
        },
        adminId,
      );

      expect(transactionWhitelistUserFindFirstMock).toHaveBeenNthCalledWith(2, {
        where: {
          id: {
            not: whitelistUserId,
          },
          email: {
            equals: correctedEmail,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

      expect(transactionUserFindFirstMock).toHaveBeenCalledWith({
        where: {
          email: {
            equals: correctedEmail,
            mode: 'insensitive',
          },
        },
        select: {
          id: true,
        },
      });

      expect(transactionInvitationUpdateManyMock).toHaveBeenCalledWith({
        where: {
          whitelistUserId,
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.REVOKED,
        },
      });

      expect(transactionAdminActionLogCreateMock).toHaveBeenCalledWith({
        data: {
          adminId,
          actionType: AdminActionType.WHITELIST,
          action: AdminAction.UPDATE_WHITELIST_USER,
          targetId: whitelistUserId,
          metadata: {
            previous: {
              name: editableWhitelistUser.name,
              studentNumber: editableWhitelistUser.studentNumber,
              email: editableWhitelistUser.email,
            },
            updated: {
              name: editableWhitelistUser.name,
              studentNumber: editableWhitelistUser.studentNumber,
              email: correctedEmail,
            },
            changedFields: ['email'],
            reason: 'Corrected after student reported a wrong email',
            revokedInvitationCount: 1,
          },
        },
      });

      expect(result.email).toBe(correctedEmail);
      expect(result.invitationStatus).toBe('invited');
    });

    it('should update the student number when it is not already in use', async () => {
      transactionWhitelistUserFindFirstMock
        .mockResolvedValueOnce(editableWhitelistUser)
        .mockResolvedValueOnce(null);

      transactionUserFindFirstMock.mockResolvedValue(null);

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      const correctedStudentNumber = '20999999';

      transactionWhitelistUserFindUniqueOrThrowMock.mockResolvedValue({
        ...editableWhitelistUser,
        studentNumber: correctedStudentNumber,
      });

      const result = await service.update(
        whitelistUserId,
        {
          studentNumber: correctedStudentNumber,
          reason: 'Corrected after verification',
        },
        adminId,
      );

      expect(transactionInvitationUpdateManyMock).not.toHaveBeenCalled();

      expect(result.studentNumber).toBe(correctedStudentNumber);
    });

    it('should reject an update when no identity value actually changes', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue(
        editableWhitelistUser,
      );

      await expect(
        service.update(
          whitelistUserId,
          {
            name: editableWhitelistUser.name,
            reason: 'No actual change',
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
      expect(transactionInvitationUpdateManyMock).not.toHaveBeenCalled();
      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();
    });

    it('should reject correction of an accepted whitelist user', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue({
        ...editableWhitelistUser,
        invitationStatus: WhitelistInvitationStatus.ACCEPTED,
      });

      await expect(
        service.update(
          whitelistUserId,
          {
            name: 'Corrected Student',
            reason: 'Correction requested',
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
    });

    it('should reject correction of a whitelist user linked to an account', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue({
        ...editableWhitelistUser,
        userId: 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54',
      });

      await expect(
        service.update(
          whitelistUserId,
          {
            name: 'Corrected Student',
            reason: 'Correction requested',
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
    });

    it('should reject an email already used by another whitelist user', async () => {
      transactionWhitelistUserFindFirstMock
        .mockResolvedValueOnce(editableWhitelistUser)
        .mockResolvedValueOnce({
          id: 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54',
        });

      await expect(
        service.update(
          whitelistUserId,
          {
            email: 'duplicate@connect.ust.hk',
            reason: 'Corrected email',
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionUserFindFirstMock).not.toHaveBeenCalled();
      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
    });

    it('should reject a student number already used by another registered user', async () => {
      transactionWhitelistUserFindFirstMock
        .mockResolvedValueOnce(editableWhitelistUser)
        .mockResolvedValueOnce(null);

      transactionUserFindFirstMock.mockResolvedValue({
        id: 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54',
      });

      await expect(
        service.update(
          whitelistUserId,
          {
            studentNumber: '20999999',
            reason: 'Corrected student number',
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
    });

    it('should reject the update when the whitelist state changes concurrently', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue(
        editableWhitelistUser,
      );

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.update(
          whitelistUserId,
          {
            name: 'Corrected Student',
            reason: 'Correction requested',
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionInvitationUpdateManyMock).not.toHaveBeenCalled();
      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();
    });

    it('should return not found for a deleted or missing whitelist user', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue(null);

      await expect(
        service.update(
          whitelistUserId,
          {
            name: 'Corrected Student',
            reason: 'Correction requested',
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should soft delete the whitelist user and revoke active invitations', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue(
        baseWhitelistUser,
      );

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionInvitationUpdateManyMock.mockResolvedValue({
        count: 2,
      });

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      const result = await service.remove(whitelistUserId, adminId);

      expect(transactionWhitelistUserUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: whitelistUserId,
          deletedAt: null,
          userId: null,
          invitationStatus: {
            not: WhitelistInvitationStatus.ACCEPTED,
          },
        },
        data: {
          deletedAt: expect.any(Date) as unknown,
        },
      });

      expect(transactionInvitationUpdateManyMock).toHaveBeenCalledWith({
        where: {
          whitelistUserId,
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.REVOKED,
        },
      });

      expect(transactionAdminActionLogCreateMock).toHaveBeenCalledWith({
        data: {
          adminId,
          actionType: AdminActionType.WHITELIST,
          action: AdminAction.DELETE_WHITELIST_USER,
          targetId: whitelistUserId,
          metadata: {
            name: baseWhitelistUser.name,
            studentNumber: baseWhitelistUser.studentNumber,
            email: baseWhitelistUser.email,
            invitationStatus: baseWhitelistUser.invitationStatus,
          },
        },
      });

      expect(result).toEqual({
        deletedWhitelistUserId: whitelistUserId,
      });
    });

    it('should return not found when the whitelist user is already deleted', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue(null);

      await expect(
        service.remove(whitelistUserId, adminId),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(transactionWhitelistUserFindFirstMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: whitelistUserId,
            deletedAt: null,
          },
        }),
      );

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();

      expect(transactionInvitationUpdateManyMock).not.toHaveBeenCalled();
    });

    it('should reject deletion when the whitelist user is accepted', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue({
        ...baseWhitelistUser,
        invitationStatus: WhitelistInvitationStatus.ACCEPTED,
      });

      await expect(
        service.remove(whitelistUserId, adminId),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();

      expect(transactionInvitationUpdateManyMock).not.toHaveBeenCalled();
    });

    it('should reject deletion when the whitelist user is linked to a user account', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue({
        ...baseWhitelistUser,
        userId: 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54',
      });

      await expect(
        service.remove(whitelistUserId, adminId),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
    });

    it('should reject deletion when the whitelist state changes before the update', async () => {
      transactionWhitelistUserFindFirstMock.mockResolvedValue(
        baseWhitelistUser,
      );

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(
        service.remove(whitelistUserId, adminId),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionInvitationUpdateManyMock).not.toHaveBeenCalled();

      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const createDto = {
      name: 'Restored Student',
      studentNumber: '20912345',
      email: 'student@connect.ust.hk',
    };

    it('should restore an exact soft-deleted whitelist match', async () => {
      whitelistUserFindManyMock.mockResolvedValue([
        {
          id: whitelistUserId,
          email: createDto.email,
          studentNumber: createDto.studentNumber,
          deletedAt,
          invitationStatus: WhitelistInvitationStatus.INVITED,
          userId: null,
        },
      ]);

      userFindFirstMock.mockResolvedValue(null);

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      const restoredWhitelistUser = {
        id: whitelistUserId,
        name: createDto.name,
        studentNumber: createDto.studentNumber,
        email: createDto.email,
        invitationStatus: WhitelistInvitationStatus.PENDING,
        invitedAt: null,
        acceptedAt: null,
        createdAt,
        updatedAt,
      };

      transactionWhitelistUserFindUniqueOrThrowMock.mockResolvedValue(
        restoredWhitelistUser,
      );

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      const result = await service.create(createDto, adminId);

      expect(transactionWhitelistUserUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: whitelistUserId,
          deletedAt: {
            not: null,
          },
          userId: null,
        },
        data: {
          name: createDto.name,
          deletedAt: null,
          invitationStatus: WhitelistInvitationStatus.PENDING,
          invitedBy: null,
          invitedAt: null,
          acceptedAt: null,
        },
      });

      expect(transactionWhitelistUserCreateMock).not.toHaveBeenCalled();

      expect(transactionAdminActionLogCreateMock).toHaveBeenCalledWith({
        data: {
          adminId,
          actionType: AdminActionType.WHITELIST,
          action: AdminAction.CREATE_WHITELIST_USER,
          targetId: whitelistUserId,
          metadata: {
            name: createDto.name,
            studentNumber: createDto.studentNumber,
            email: createDto.email,
            restored: true,
          },
        },
      });

      expect(result).toEqual({
        whitelistUserId,
        name: createDto.name,
        studentNumber: createDto.studentNumber,
        email: createDto.email,
        invitationStatus: 'pending',
        invitedAt: null,
        acceptedAt: null,
        createdAt,
        updatedAt,
      });
    });

    it('should reject restoration when only the email matches a deleted whitelist row', async () => {
      whitelistUserFindManyMock.mockResolvedValue([
        {
          id: whitelistUserId,
          email: createDto.email,
          studentNumber: 'DIFFERENT-STUDENT-NUMBER',
          deletedAt,
          invitationStatus: WhitelistInvitationStatus.PENDING,
          userId: null,
        },
      ]);

      userFindFirstMock.mockResolvedValue(null);

      await expect(service.create(createDto, adminId)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('should reject restoration when only the student number matches a deleted whitelist row', async () => {
      whitelistUserFindManyMock.mockResolvedValue([
        {
          id: whitelistUserId,
          email: 'different@connect.ust.hk',
          studentNumber: createDto.studentNumber,
          deletedAt,
          invitationStatus: WhitelistInvitationStatus.PENDING,
          userId: null,
        },
      ]);

      userFindFirstMock.mockResolvedValue(null);

      await expect(service.create(createDto, adminId)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('should reject restoration if a KSA user already exists', async () => {
      whitelistUserFindManyMock.mockResolvedValue([
        {
          id: whitelistUserId,
          email: createDto.email,
          studentNumber: createDto.studentNumber,
          deletedAt,
          invitationStatus: WhitelistInvitationStatus.PENDING,
          userId: null,
        },
      ]);

      userFindFirstMock.mockResolvedValue({
        email: createDto.email,
        studentNumber: createDto.studentNumber,
      });

      await expect(service.create(createDto, adminId)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('should reject restoration when the deleted row state changes before the update', async () => {
      whitelistUserFindManyMock.mockResolvedValue([
        {
          id: whitelistUserId,
          email: createDto.email,
          studentNumber: createDto.studentNumber,
          deletedAt,
          invitationStatus: WhitelistInvitationStatus.PENDING,
          userId: null,
        },
      ]);

      userFindFirstMock.mockResolvedValue(null);

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      await expect(service.create(createDto, adminId)).rejects.toBeInstanceOf(
        ConflictException,
      );

      expect(
        transactionWhitelistUserFindUniqueOrThrowMock,
      ).not.toHaveBeenCalled();

      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('importUsers', () => {
    const importRow = {
      name: 'Imported Student',
      studentNumber: '20912345',
      email: 'student@connect.ust.hk',
    };

    const softDeletedWhitelist = {
      id: whitelistUserId,
      email: importRow.email,
      studentNumber: importRow.studentNumber,
      invitationStatus: WhitelistInvitationStatus.INVITED,
      userId: null,
      deletedAt,
    };

    it('should skip an exact soft-deleted whitelist match with skip policy', async () => {
      whitelistUserFindManyMock.mockResolvedValue([softDeletedWhitelist]);
      userFindManyMock.mockResolvedValue([]);

      const result = await service.importUsers(
        {
          onDuplicate: WhitelistImportDuplicatePolicy.SKIP,
          users: [importRow],
        },
        adminId,
      );

      expect(result).toEqual({
        totalCount: 1,
        successCount: 0,
        skippedCount: 1,
        failedCount: 0,
        results: [
          {
            rowIndex: 1,
            email: importRow.email,
            studentNumber: importRow.studentNumber,
            status: ImportRowStatusValue.SKIPPED,
            whitelistUserId,
            errorMessage:
              'Email or student number already exists in the whitelist',
          },
        ],
      });

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('should fail the whole import for an exact soft-deleted whitelist match with fail policy', async () => {
      whitelistUserFindManyMock.mockResolvedValue([softDeletedWhitelist]);
      userFindManyMock.mockResolvedValue([]);

      await expect(
        service.importUsers(
          {
            onDuplicate: WhitelistImportDuplicatePolicy.FAIL,
            users: [importRow],
          },
          adminId,
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('should restore an exact soft-deleted whitelist match with update policy', async () => {
      whitelistUserFindManyMock.mockResolvedValue([softDeletedWhitelist]);
      userFindManyMock.mockResolvedValue([]);

      transactionWhitelistUserUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      const result = await service.importUsers(
        {
          onDuplicate: WhitelistImportDuplicatePolicy.UPDATE,
          users: [importRow],
        },
        adminId,
      );

      expect(transactionWhitelistUserUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: whitelistUserId,
          deletedAt: {
            not: null,
          },
          userId: null,
          invitationStatus: {
            not: WhitelistInvitationStatus.ACCEPTED,
          },
        },
        data: {
          name: importRow.name,
          studentNumber: importRow.studentNumber,
          email: importRow.email,
          deletedAt: null,
          invitationStatus: WhitelistInvitationStatus.PENDING,
          invitedBy: null,
          invitedAt: null,
          acceptedAt: null,
        },
      });

      expect(result).toEqual({
        totalCount: 1,
        successCount: 1,
        skippedCount: 0,
        failedCount: 0,
        results: [
          {
            rowIndex: 1,
            email: importRow.email,
            studentNumber: importRow.studentNumber,
            status: ImportRowStatusValue.UPDATED,
            whitelistUserId,
            errorMessage: null,
          },
        ],
      });
    });

    it('should fail update when only the email matches a soft-deleted whitelist row', async () => {
      whitelistUserFindManyMock.mockResolvedValue([
        {
          ...softDeletedWhitelist,
          studentNumber: 'DIFFERENT-STUDENT-NUMBER',
        },
      ]);
      userFindManyMock.mockResolvedValue([]);

      const result = await service.importUsers(
        {
          onDuplicate: WhitelistImportDuplicatePolicy.UPDATE,
          users: [importRow],
        },
        adminId,
      );

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          status: ImportRowStatusValue.FAILED,
          whitelistUserId: null,
        }),
      );

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it('should fail update when only the student number matches a soft-deleted whitelist row', async () => {
      whitelistUserFindManyMock.mockResolvedValue([
        {
          ...softDeletedWhitelist,
          email: 'different@connect.ust.hk',
        },
      ]);
      userFindManyMock.mockResolvedValue([]);

      const result = await service.importUsers(
        {
          onDuplicate: WhitelistImportDuplicatePolicy.UPDATE,
          users: [importRow],
        },
        adminId,
      );

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          status: ImportRowStatusValue.FAILED,
          whitelistUserId: null,
        }),
      );

      expect(transactionMock).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'INVITED whitelist user',
        invitationStatus: WhitelistInvitationStatus.INVITED,
        userId: null,
      },
      {
        name: 'ACCEPTED whitelist user',
        invitationStatus: WhitelistInvitationStatus.ACCEPTED,
        userId: null,
      },
      {
        name: 'whitelist user linked to an account',
        invitationStatus: WhitelistInvitationStatus.PENDING,
        userId: 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54',
      },
    ])(
      'should block update for an active $name',
      async ({ invitationStatus, userId }) => {
        whitelistUserFindManyMock.mockResolvedValue([
          {
            id: whitelistUserId,
            email: importRow.email,
            studentNumber: importRow.studentNumber,
            invitationStatus,
            userId,
            deletedAt: null,
          },
        ]);

        userFindManyMock.mockResolvedValue([]);

        const result = await service.importUsers(
          {
            onDuplicate: WhitelistImportDuplicatePolicy.UPDATE,
            users: [importRow],
          },
          adminId,
        );

        expect(result.results[0]).toEqual(
          expect.objectContaining({
            status: ImportRowStatusValue.FAILED,
            whitelistUserId: null,
            errorMessage:
              'This whitelist user cannot be updated in the current status',
          }),
        );

        expect(transactionMock).not.toHaveBeenCalled();

        expect(transactionWhitelistUserUpdateManyMock).not.toHaveBeenCalled();
        expect(transactionWhitelistUserCreateMock).not.toHaveBeenCalled();
        expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();
      },
    );

    it('should accept a 128-character name in bulk import', async () => {
      const row = {
        ...importRow,
        name: 'a'.repeat(128),
      };

      whitelistUserFindManyMock.mockResolvedValue([]);
      userFindManyMock.mockResolvedValue([]);

      transactionWhitelistUserCreateMock.mockResolvedValue({
        id: whitelistUserId,
      });

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      const result = await service.importUsers(
        {
          onDuplicate: WhitelistImportDuplicatePolicy.SKIP,
          users: [row],
        },
        adminId,
      );

      expect(transactionWhitelistUserCreateMock).toHaveBeenCalledWith({
        data: {
          name: row.name,
          studentNumber: row.studentNumber,
          email: row.email,
        },
        select: {
          id: true,
        },
      });

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          status: ImportRowStatusValue.CREATED,
          whitelistUserId,
          errorMessage: null,
        }),
      );
    });

    it('should reject a 129-character name in bulk import', async () => {
      const row = {
        ...importRow,
        name: 'a'.repeat(129),
      };

      const result = await service.importUsers(
        {
          onDuplicate: WhitelistImportDuplicatePolicy.SKIP,
          users: [row],
        },
        adminId,
      );

      expect(result).toEqual({
        totalCount: 1,
        successCount: 0,
        skippedCount: 0,
        failedCount: 1,
        results: [
          {
            rowIndex: 1,
            email: row.email,
            studentNumber: row.studentNumber,
            status: ImportRowStatusValue.FAILED,
            whitelistUserId: null,
            errorMessage: 'Name must not exceed 128 characters',
          },
        ],
      });

      expect(whitelistUserFindManyMock).not.toHaveBeenCalled();
      expect(userFindManyMock).not.toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
    });
  });
});
