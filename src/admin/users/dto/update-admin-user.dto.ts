import { UserRole, UserStatus } from '@prisma/client';
import { IsEnum, ValidateIf } from 'class-validator';

export class UpdateAdminUserDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(UserRole)
  role?: UserRole;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(UserStatus)
  status?: UserStatus;
}
