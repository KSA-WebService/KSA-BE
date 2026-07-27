import { Type, Transform } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { WhitelistInvitationStatus } from '@prisma/client';

export enum WhitelistUserSortField {
  NAME = 'name',
  STUDENT_NUMBER = 'studentNumber',
  EMAIL = 'email',
  INVITATION_STATUS = 'invitationStatus',
  INVITED_AT = 'invitedAt',
  CREATED_AT = 'createdAt',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class GetWhitelistUsersQueryDto {
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
  @Transform(({ value }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === '' ? undefined : trimmedValue;
  })
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(WhitelistInvitationStatus)
  invitationStatus?: WhitelistInvitationStatus;

  @IsOptional()
  @IsEnum(WhitelistUserSortField)
  sort: WhitelistUserSortField = WhitelistUserSortField.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  order: SortOrder = SortOrder.ASC;
}