import { IsEnum, ValidateIf } from 'class-validator';
import {
  UserRoleValue,
  UserStatusValue,
} from '../../../common/constants/user-api-values';

export class UpdateAdminUserDto {
  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(UserRoleValue)
  role?: UserRoleValue;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(UserStatusValue)
  status?: UserStatusValue;
}
