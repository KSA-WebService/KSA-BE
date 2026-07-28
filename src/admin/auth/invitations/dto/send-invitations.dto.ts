import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import {
  InvitationLinkStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';

export class SendInvitationsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  whitelistUserIds!: string[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours = 72;
}

export type InvitationSendStatus = 'SENT' | 'SKIPPED' | 'FAILED';

export interface SendInvitationResult {
  whitelistUserId: string;
  email: string | null;
  invitationId: string | null;
  sendStatus: InvitationSendStatus;
  invitationStatus: WhitelistInvitationStatus | null;
  linkStatus: InvitationLinkStatus | null;
  sentAt: Date | null;
  expiresAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface SendInvitationsResponse {
  requestedCount: number;
  sentCount: number;
  skippedCount: number;
  failedCount: number;
  results: SendInvitationResult[];
}

export type InvitationResendStatus = 'RESENT' | 'SKIPPED' | 'FAILED';

export interface ResendInvitationResult {
  whitelistUserId: string;
  email: string | null;
  invitationId: string | null;
  sendStatus: InvitationResendStatus;
  invitationStatus: WhitelistInvitationStatus | null;
  linkStatus: InvitationLinkStatus | null;
  sentAt: Date | null;
  expiresAt: Date | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface ResendInvitationsResponse {
  requestedCount: number;
  resentCount: number;
  skippedCount: number;
  failedCount: number;
  results: ResendInvitationResult[];
}
