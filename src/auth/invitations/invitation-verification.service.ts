import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  VerifyInvitationDto,
  VerifyInvitationResponse,
} from './dto/verify-invitation.dto';
import { InvitationEligibilityService } from './invitation-eligibility.service';

@Injectable()
export class InvitationVerificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly invitationEligibilityService: InvitationEligibilityService,
  ) {}

  async verify(dto: VerifyInvitationDto): Promise<VerifyInvitationResponse> {
    /*
     * 토큰 형식, 해시, 링크 상태, 만료 시각,
     * WhitelistedUser 상태 검사는 공통 서비스가 담당한다.
     */
    const invitation = await this.invitationEligibilityService.validate(
      dto.token,
    );

    const whitelistUser = invitation.whitelistUser;

    /*
     * WhitelistedUser.userId가 null인 비정상 상태에서도
     * 동일 이메일 또는 동일 학번의 KSA User가 존재하면
     * 중복 가입을 허용하지 않는다.
     */
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
      throw new ConflictException({
        errorCode: 'I409_INVITATION_ALREADY_ACCEPTED',
        message: 'The invitation has already been accepted',
        data: null,
      });
    }

    /*
     * 초대 검증 API는 계정을 생성하거나 상태를 ACCEPTED로 바꾸지 않고,
     * 가입 화면에 표시할 정보만 반환한다.
     */
    return {
      name: whitelistUser.name,
      email: whitelistUser.email,
      studentNumber: whitelistUser.studentNumber,
      expiresAt: invitation.expiresAt.toISOString(),
    };
  }
}
