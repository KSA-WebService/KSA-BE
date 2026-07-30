import { Transform, TransformFnParams, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';

export enum AdminUserSortField {
  NAME = 'name',
  STUDENT_NUMBER = 'studentNumber',
  EMAIL = 'email',
  ROLE = 'role',
  TOKEN_BALANCE = 'tokenBalance',
  STATUS = 'status',
  CREATED_AT = 'createdAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetAdminUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;

  @IsOptional()
  @Transform(({ value }: TransformFnParams): unknown => {
    const rawValue: unknown = value;

    if (typeof rawValue !== 'string') {
      return rawValue;
    }

    const trimmedValue = rawValue.trim();

    return trimmedValue === '' ? undefined : trimmedValue;
  })
  @IsString()
  @MaxLength(255)
  keyword?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @IsEnum(AdminUserSortField)
  sort: AdminUserSortField = AdminUserSortField.CREATED_AT;

  @IsOptional()
  @IsEnum(SortOrder)
  order: SortOrder = SortOrder.DESC;
}
