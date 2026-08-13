import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  InvitationLinkStatus,
  Prisma,
  UserRole,
  UserStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CompleteOnboardingDto,
  CompleteOnboardingResponse,
} from './dto/complete-onboarding.dto';
import { InvitationEligibilityService } from '../invitations/invitation-eligibility.service';
import { SupabaseAdminService } from '../supabase-admin.service';
import {
  USER_ROLE_VALUE_MAP,
  USER_STATUS_VALUE_MAP,
} from '../../common/constants/user-api-values';

class ActivationStateChangedError extends Error {
  constructor() {
    super('Invitation state changed during account activation');
  }
}

@Injectable()
export class OnboardingService {
  private readonly logger = new Logger(OnboardingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationEligibilityService: InvitationEligibilityService,
    private readonly supabaseAdminService: SupabaseAdminService,
  ) {}

  async complete(
    dto: CompleteOnboardingDto,
  ): Promise<CompleteOnboardingResponse> {
    const password = this.validatePassword(dto.password);
    this.validatePrivacyConsent(dto.agreedPrivacy);

    /*
     * verify API를 앞에서 호출했더라도 계정 생성 직전에 다시 검사한다.
     * 그 사이 링크가 만료되거나 재발송될 수 있기 때문이다.
     */
    const invitation = await this.invitationEligibilityService.validate(
      dto.token,
    );

    const whitelistUser = invitation.whitelistUser;

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          {
            email: {
              equals: whitelistUser.email,
              mode: 'insensitive',
            },
          },
          {
            studentNumber: whitelistUser.studentNumber,
          },
        ],
      },
      select: {
        id: true,
      },
    });

    if (existingUser) {
      throw this.accountAlreadyExistsException();
    }

    let authUserId: string;

    /*
     * 먼저 Supabase Auth 계정을 생성한다.
     * 이후 DB Transaction이 실패하면 이 계정을 보상 삭제한다.
     */
    try {
      const authUser = await this.supabaseAdminService.createConfirmedUser(
        whitelistUser.email,
        password,
      );

      authUserId = authUser.id;
    } catch (error: unknown) {
      this.throwMappedSupabaseCreateError(error);
    }

    const acceptedAt = new Date();

    try {
      const createdUser = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            id: authUserId,
            name: whitelistUser.name,
            email: whitelistUser.email,
            studentNumber: whitelistUser.studentNumber,
            role: UserRole.STUDENT,
            status: UserStatus.ACTIVE,
            tokenBalance: 0,
            agreedPrivacy: true,
            agreedAt: acceptedAt,
          },
          select: {
            id: true,
            name: true,
            email: true,
            studentNumber: true,
            role: true,
            status: true,
            tokenBalance: true,
            createdAt: true,
          },
        });

        /*
         * 초기 검증 후 상태가 바뀌었는지 조건부 update로 다시 확인한다.
         */
        const invitationUpdate = await tx.invitation.updateMany({
          where: {
            id: invitation.invitationId,
            whitelistUserId: invitation.whitelistUserId,
            linkStatus: InvitationLinkStatus.ACTIVE,
            expiresAt: {
              gt: acceptedAt,
            },
          },
          data: {
            linkStatus: InvitationLinkStatus.ACCEPTED,
            acceptedAt,
          },
        });

        if (invitationUpdate.count !== 1) {
          throw new ActivationStateChangedError();
        }

        const whitelistUpdate = await tx.whitelistedUser.updateMany({
          where: {
            id: invitation.whitelistUserId,
            userId: null,
            invitationStatus: WhitelistInvitationStatus.INVITED,
          },
          data: {
            userId: authUserId,
            invitationStatus: WhitelistInvitationStatus.ACCEPTED,
            acceptedAt,
          },
        });

        if (whitelistUpdate.count !== 1) {
          throw new ActivationStateChangedError();
        }

        /*
         * 같은 WhitelistedUser에게 발급된 다른 활성 링크는 폐기한다.
         */
        await tx.invitation.updateMany({
          where: {
            whitelistUserId: invitation.whitelistUserId,
            id: {
              not: invitation.invitationId,
            },
            linkStatus: InvitationLinkStatus.ACTIVE,
          },
          data: {
            linkStatus: InvitationLinkStatus.REVOKED,
          },
        });

        return user;
      });

      return {
        userId: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        studentNumber: createdUser.studentNumber,
        role: USER_ROLE_VALUE_MAP[createdUser.role],
        status: USER_STATUS_VALUE_MAP[createdUser.status],
        tokenBalance: createdUser.tokenBalance,
        createdAt: createdUser.createdAt.toISOString(),
      };
    } catch (error: unknown) {
      /*
       * DB 처리가 실패했으므로 이번 요청에서 생성한 Auth 계정을 삭제한다.
       */
      await this.compensateCreatedAuthUser(authUserId);

      /*
       * 초대 상태가 중간에 바뀐 경우 최신 상태로 다시 검증하여
       * ACCEPTED / REVOKED / EXPIRED 등의 정확한 오류를 반환한다.
       */
      if (error instanceof ActivationStateChangedError) {
        await this.invitationEligibilityService.validate(dto.token);
      }

      /*
       * 이메일 또는 학번 unique constraint 충돌
       */
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw this.accountAlreadyExistsException();
      }

      if (error instanceof HttpException) {
        throw error;
      }

      this.logger.error(
        `KSA account activation failed: ${this.getErrorMessage(error)}`,
      );

      throw new InternalServerErrorException({
        errorCode: 'A500_ACCOUNT_ACTIVATION_FAILED',
        message: 'Failed to complete account activation',
        data: null,
      });
    }
  }

  private validatePassword(password: unknown): string {
    if (typeof password !== 'string') {
      throw this.weakPasswordException();
    }

    /*
     * 8~72자, 대문자·소문자·숫자·특수문자 각각 1개 이상,
     * 공백은 허용하지 않는다.
     *
     * 비밀번호에는 trim()을 적용하지 않는다.
     */
    const passwordPattern =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S{8,72}$/;

    if (!passwordPattern.test(password)) {
      throw this.weakPasswordException();
    }

    return password;
  }

  private validatePrivacyConsent(agreedPrivacy: unknown): void {
    if (agreedPrivacy !== true) {
      throw new BadRequestException({
        errorCode: 'A400_PRIVACY_CONSENT_REQUIRED',
        message: 'Privacy policy consent is required',
        data: null,
      });
    }
  }

  private weakPasswordException(): BadRequestException {
    return new BadRequestException({
      errorCode: 'A400_WEAK_PASSWORD',
      message: 'The password does not meet the required security rules',
      data: null,
    });
  }

  private accountAlreadyExistsException(): ConflictException {
    return new ConflictException({
      errorCode: 'A409_ACCOUNT_ALREADY_EXISTS',
      message: 'An account already exists for this user',
      data: null,
    });
  }

  /*
   * Supabase Auth의 공식 오류 code를 기준으로 분기한다.
   * 오류 메시지 문자열 자체를 비교하지 않는다.
   */
  private throwMappedSupabaseCreateError(error: unknown): never {
    const errorCode = this.getSupabaseErrorCode(error);

    if (errorCode === 'email_exists' || errorCode === 'user_already_exists') {
      throw this.accountAlreadyExistsException();
    }

    if (errorCode === 'weak_password') {
      throw this.weakPasswordException();
    }

    this.logger.error(
      `Supabase Auth user creation failed: ${this.getErrorMessage(error)}`,
    );

    throw new ServiceUnavailableException({
      errorCode: 'A503_AUTH_PROVIDER_UNAVAILABLE',
      message: 'The authentication service is temporarily unavailable',
      data: null,
    });
  }

  private async compensateCreatedAuthUser(userId: string): Promise<void> {
    try {
      await this.supabaseAdminService.deleteUser(userId);
    } catch (cleanupError: unknown) {
      /*
       * 사용자 응답에는 Auth User ID를 노출하지 않지만,
       * 서버 로그에는 수동 정리를 위해 남긴다.
       */
      this.logger.error(
        `Failed to remove orphaned Supabase Auth user ${userId}: ` +
          this.getErrorMessage(cleanupError),
      );
    }
  }

  private getSupabaseErrorCode(error: unknown): string | undefined {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'string'
    ) {
      return error.code;
    }

    return undefined;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    return 'Unknown error';
  }
}
