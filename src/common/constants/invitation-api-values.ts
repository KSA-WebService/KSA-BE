import {
  InvitationLinkStatus,
  WhitelistInvitationStatus,
} from '@prisma/client';

export enum WhitelistInvitationStatusValue {
  PENDING = 'pending',
  INVITED = 'invited',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  FAILED = 'failed',
}

export enum InvitationLinkStatusValue {
  ACTIVE = 'active',
  ACCEPTED = 'accepted',
  EXPIRED = 'expired',
  REVOKED = 'revoked',
  FAILED = 'failed',
}

export const WHITELIST_INVITATION_STATUS_VALUE_MAP: Record<
  WhitelistInvitationStatus,
  WhitelistInvitationStatusValue
> = {
  [WhitelistInvitationStatus.PENDING]: WhitelistInvitationStatusValue.PENDING,
  [WhitelistInvitationStatus.INVITED]: WhitelistInvitationStatusValue.INVITED,
  [WhitelistInvitationStatus.ACCEPTED]: WhitelistInvitationStatusValue.ACCEPTED,
  [WhitelistInvitationStatus.EXPIRED]: WhitelistInvitationStatusValue.EXPIRED,
  [WhitelistInvitationStatus.FAILED]: WhitelistInvitationStatusValue.FAILED,
};

export const WHITELIST_INVITATION_STATUS_PRISMA_MAP: Record<
  WhitelistInvitationStatusValue,
  WhitelistInvitationStatus
> = {
  [WhitelistInvitationStatusValue.PENDING]: WhitelistInvitationStatus.PENDING,
  [WhitelistInvitationStatusValue.INVITED]: WhitelistInvitationStatus.INVITED,
  [WhitelistInvitationStatusValue.ACCEPTED]: WhitelistInvitationStatus.ACCEPTED,
  [WhitelistInvitationStatusValue.EXPIRED]: WhitelistInvitationStatus.EXPIRED,
  [WhitelistInvitationStatusValue.FAILED]: WhitelistInvitationStatus.FAILED,
};

export const INVITATION_LINK_STATUS_VALUE_MAP: Record<
  InvitationLinkStatus,
  InvitationLinkStatusValue
> = {
  [InvitationLinkStatus.ACTIVE]: InvitationLinkStatusValue.ACTIVE,
  [InvitationLinkStatus.ACCEPTED]: InvitationLinkStatusValue.ACCEPTED,
  [InvitationLinkStatus.EXPIRED]: InvitationLinkStatusValue.EXPIRED,
  [InvitationLinkStatus.REVOKED]: InvitationLinkStatusValue.REVOKED,
  [InvitationLinkStatus.FAILED]: InvitationLinkStatusValue.FAILED,
};
