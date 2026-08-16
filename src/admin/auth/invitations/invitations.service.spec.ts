import 'reflect-metadata';

import {
  InvitationLinkStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';

import { PrismaService } from '../../../prisma/prisma.service';
import {
  InvitationResendStatusValue,
  InvitationSendStatusValue,
  SendInvitationsDto,
} from './dto/send-invitations.dto';
import { InvitationMailService } from './invitation-mail.service';
import { InvitationsService } from './invitations.service';

describe('InvitationsService', () => {
  let service: InvitationsService;

  const whitelistUserFindManyMock = jest.fn();
  const whitelistUserUpdateManyMock = jest.fn();

  const invitationCreateMock = jest.fn();
  const invitationUpdateManyMock = jest.fn();

  const transactionInvitationFindManyMock = jest.fn();
  const transactionAdminActionLogCreateMock = jest.fn();

  const transactionClientMock = {
    whitelistedUser: {
      updateMany: whitelistUserUpdateManyMock,
    },
    invitation: {
      findMany: transactionInvitationFindManyMock,
      updateMany: invitationUpdateManyMock,
    },
    adminActionLog: {
      create: transactionAdminActionLogCreateMock,
    },
  };

  const transactionMock = jest.fn();

  const prismaServiceMock = {
    whitelistedUser: {
      findMany: whitelistUserFindManyMock,
      updateMany: whitelistUserUpdateManyMock,
    },
    invitation: {
      create: invitationCreateMock,
      updateMany: invitationUpdateManyMock,
    },
    $transaction: transactionMock,
  };

  const sendInvitationEmailMock = jest.fn();

  const invitationMailServiceMock = {
    sendInvitationEmail: sendInvitationEmailMock,
  };

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const whitelistUserId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const invitationId = 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54';

  const previousInvitationId = 'c5b922c5-9ca5-4c29-81e6-8faec8fbda56';

  const updatedAt = new Date('2026-08-13T00:00:00.000Z');

  const pendingWhitelistUser = {
    id: whitelistUserId,
    name: 'HKUST Student',
    email: 'student@connect.ust.hk',
    userId: null,
    invitationStatus: WhitelistInvitationStatus.PENDING,
    updatedAt,
  };

  const invitedWhitelistUser = {
    ...pendingWhitelistUser,
    invitationStatus: WhitelistInvitationStatus.INVITED,
  };

  const dto: SendInvitationsDto = {
    whitelistUserIds: [whitelistUserId],
    expiresInHours: 24,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-14T03:00:00.000Z'));

    process.env.INVITATION_SIGNUP_URL = 'http://localhost:3000/auth/signup';

    /*
     * Prisma $transaction은 이 서비스에서 두 방식으로 사용된다.
     *
     * 1. $transaction([promise1, promise2])
     * 2. $transaction(async (tx) => ...)
     */
    transactionMock.mockImplementation(
      async (
        argument:
          | Promise<unknown>[]
          | ((tx: typeof transactionClientMock) => Promise<unknown>),
      ) => {
        if (Array.isArray(argument)) {
          return Promise.all(argument);
        }

        return argument(transactionClientMock);
      },
    );

    service = new InvitationsService(
      prismaServiceMock as unknown as PrismaService,
      invitationMailServiceMock as unknown as InvitationMailService,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.INVITATION_SIGNUP_URL;
  });

  describe('send', () => {
    it('should exclude soft-deleted whitelist users from invitation sending', async () => {
      /*
       * findMany에 deletedAt: null이 있기 때문에
       * soft-deleted row는 DB 조회 결과에 나타나지 않는 상황을 모사한다.
       */
      whitelistUserFindManyMock.mockResolvedValue([]);

      const result = await service.send(dto, adminId);

      expect(whitelistUserFindManyMock).toHaveBeenCalledWith({
        where: {
          id: {
            in: dto.whitelistUserIds,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          userId: true,
          invitationStatus: true,
          updatedAt: true,
        },
      });

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          whitelistUserId,
          sendStatus: InvitationSendStatusValue.FAILED,
          errorCode: 'I404_WHITELIST_USER_NOT_FOUND',
          errorMessage: 'Whitelist user not found',
        }),
      );

      expect(invitationCreateMock).not.toHaveBeenCalled();
      expect(sendInvitationEmailMock).not.toHaveBeenCalled();
    });

    it('should revoke the new invitation when the whitelist state changes after the email is sent', async () => {
      whitelistUserFindManyMock.mockResolvedValue([pendingWhitelistUser]);

      invitationCreateMock.mockResolvedValue({
        id: invitationId,
      });

      sendInvitationEmailMock.mockResolvedValue(undefined);

      /*
       * 이메일 발송 이후 whitelist가 삭제되거나 다른 요청에 의해
       * updatedAt/state가 변경된 상황.
       */
      whitelistUserUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      invitationUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      const result = await service.send(dto, adminId);

      expect(whitelistUserUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: whitelistUserId,
          deletedAt: null,
          userId: null,
          invitationStatus: WhitelistInvitationStatus.PENDING,
          updatedAt,
        },
        data: {
          invitationStatus: WhitelistInvitationStatus.INVITED,
          invitedBy: adminId,
          invitedAt: expect.any(Date) as unknown,
        },
      });

      expect(invitationUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: invitationId,
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.REVOKED,
        },
      });

      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          whitelistUserId,
          invitationId,
          sendStatus: InvitationSendStatusValue.FAILED,
          invitationStatus: null,
          linkStatus: null,
          errorCode: 'I409_WHITELIST_STATE_CHANGED',
        }),
      );
    });

    it('should not overwrite a revoked invitation with failed status when email sending fails', async () => {
      whitelistUserFindManyMock.mockResolvedValue([pendingWhitelistUser]);

      invitationCreateMock.mockResolvedValue({
        id: invitationId,
      });

      sendInvitationEmailMock.mockRejectedValue(new Error('Mail failure'));

      /*
       * count 0:
       * whitelist 삭제 등으로 invitation이 이미 REVOKED된 상황.
       */
      invitationUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      whitelistUserUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      const result = await service.send(dto, adminId);

      expect(invitationUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: invitationId,
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.FAILED,
        },
      });

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          sendStatus: InvitationSendStatusValue.FAILED,
          errorCode: 'I409_WHITELIST_STATE_CHANGED',
          invitationStatus: null,
          linkStatus: null,
        }),
      );
    });
  });

  describe('resend', () => {
    it('should exclude soft-deleted whitelist users from invitation resending', async () => {
      whitelistUserFindManyMock.mockResolvedValue([]);

      const result = await service.resend(dto, adminId);

      expect(whitelistUserFindManyMock).toHaveBeenCalledWith({
        where: {
          id: {
            in: dto.whitelistUserIds,
          },
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          email: true,
          userId: true,
          invitationStatus: true,
          updatedAt: true,
        },
      });

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          whitelistUserId,
          sendStatus: InvitationResendStatusValue.FAILED,
          errorCode: 'I404_WHITELIST_USER_NOT_FOUND',
          errorMessage: 'Whitelist user not found',
        }),
      );

      expect(invitationCreateMock).not.toHaveBeenCalled();
      expect(sendInvitationEmailMock).not.toHaveBeenCalled();
    });

    it('should revoke only the new invitation when the whitelist state changes during resend', async () => {
      whitelistUserFindManyMock.mockResolvedValue([invitedWhitelistUser]);

      invitationCreateMock.mockResolvedValue({
        id: invitationId,
      });

      sendInvitationEmailMock.mockResolvedValue(undefined);

      whitelistUserUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      invitationUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      const result = await service.resend(dto, adminId);

      expect(whitelistUserUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: whitelistUserId,
          deletedAt: null,
          userId: null,
          invitationStatus: {
            in: [
              WhitelistInvitationStatus.INVITED,
              WhitelistInvitationStatus.EXPIRED,
              WhitelistInvitationStatus.FAILED,
            ],
          },
          updatedAt,
        },
        data: {
          invitationStatus: WhitelistInvitationStatus.INVITED,
          invitedBy: adminId,
          invitedAt: expect.any(Date) as unknown,
        },
      });

      expect(invitationUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: invitationId,
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.REVOKED,
        },
      });

      /*
       * state 확보에 실패했으므로 기존 ACTIVE invitation을
       * 조회하거나 revoke하면 안 된다.
       */
      expect(transactionInvitationFindManyMock).not.toHaveBeenCalled();

      expect(transactionAdminActionLogCreateMock).not.toHaveBeenCalled();

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          whitelistUserId,
          invitationId,
          sendStatus: InvitationResendStatusValue.FAILED,
          invitationStatus: null,
          linkStatus: null,
          errorCode: 'I409_WHITELIST_STATE_CHANGED',
        }),
      );
    });

    it('should revoke previous active invitations only after the whitelist state is secured', async () => {
      whitelistUserFindManyMock.mockResolvedValue([invitedWhitelistUser]);

      invitationCreateMock.mockResolvedValue({
        id: invitationId,
      });

      sendInvitationEmailMock.mockResolvedValue(undefined);

      whitelistUserUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionInvitationFindManyMock.mockResolvedValue([
        {
          id: previousInvitationId,
        },
      ]);

      invitationUpdateManyMock.mockResolvedValue({
        count: 1,
      });

      transactionAdminActionLogCreateMock.mockResolvedValue({
        id: 1,
      });

      const result = await service.resend(dto, adminId);

      expect(transactionInvitationFindManyMock).toHaveBeenCalledWith({
        where: {
          whitelistUserId,
          id: {
            not: invitationId,
          },
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        select: {
          id: true,
        },
      });

      expect(invitationUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: {
            in: [previousInvitationId],
          },
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.REVOKED,
        },
      });

      expect(transactionAdminActionLogCreateMock).toHaveBeenCalledTimes(1);

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          whitelistUserId,
          invitationId,
          sendStatus: InvitationResendStatusValue.RESENT,
          errorCode: null,
          errorMessage: null,
        }),
      );
    });

    it('should not overwrite a revoked new invitation when resend email delivery fails', async () => {
      whitelistUserFindManyMock.mockResolvedValue([invitedWhitelistUser]);

      invitationCreateMock.mockResolvedValue({
        id: invitationId,
      });

      sendInvitationEmailMock.mockRejectedValue(new Error('Mail failure'));

      /*
       * 이미 soft delete 등에 의해 REVOKED되어 ACTIVE가 아니므로
       * FAILED update가 적용되지 않는다.
       */
      invitationUpdateManyMock.mockResolvedValue({
        count: 0,
      });

      const result = await service.resend(dto, adminId);

      expect(invitationUpdateManyMock).toHaveBeenCalledWith({
        where: {
          id: invitationId,
          linkStatus: InvitationLinkStatus.ACTIVE,
        },
        data: {
          linkStatus: InvitationLinkStatus.FAILED,
        },
      });

      expect(result.results[0]).toEqual(
        expect.objectContaining({
          sendStatus: InvitationResendStatusValue.FAILED,
          invitationStatus: null,
          linkStatus: null,
          errorCode: 'I409_WHITELIST_STATE_CHANGED',
        }),
      );

      expect(transactionInvitationFindManyMock).not.toHaveBeenCalled();
    });
  });
});
