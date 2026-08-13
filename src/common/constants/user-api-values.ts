import { UserRole, UserStatus } from '@prisma/client';

export enum UserRoleValue {
  STUDENT = 'student',
  ADMIN = 'admin',
}

export enum UserStatusValue {
  ACTIVE = 'active',
  BLOCKED = 'blocked',
}

export const USER_ROLE_VALUE_MAP: Record<UserRole, UserRoleValue> = {
  [UserRole.STUDENT]: UserRoleValue.STUDENT,
  [UserRole.ADMIN]: UserRoleValue.ADMIN,
};

export const USER_STATUS_VALUE_MAP: Record<UserStatus, UserStatusValue> = {
  [UserStatus.ACTIVE]: UserStatusValue.ACTIVE,
  [UserStatus.BLOCKED]: UserStatusValue.BLOCKED,
};

export const USER_ROLE_PRISMA_MAP: Record<UserRoleValue, UserRole> = {
  [UserRoleValue.STUDENT]: UserRole.STUDENT,
  [UserRoleValue.ADMIN]: UserRole.ADMIN,
};

export const USER_STATUS_PRISMA_MAP: Record<UserStatusValue, UserStatus> = {
  [UserStatusValue.ACTIVE]: UserStatus.ACTIVE,
  [UserStatusValue.BLOCKED]: UserStatus.BLOCKED,
};
