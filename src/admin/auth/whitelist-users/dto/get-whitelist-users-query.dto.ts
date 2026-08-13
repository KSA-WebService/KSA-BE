import { Type, Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { WhitelistInvitationStatusValue } from '../../../../common/constants/invitation-api-values';
export enum WhitelistUserSortField {
  NAME = 'name',
  STUDENT_NUMBER = 'student_number',
  EMAIL = 'email',
  INVITATION_STATUS = 'invitation_status',
  INVITED_AT = 'invited_at',
  CREATED_AT = 'created_at',
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
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmedValue = value.trim();

    return trimmedValue === '' ? undefined : trimmedValue;
  })
  @IsString()
  keyword?: string;

  @IsOptional()
  @IsEnum(WhitelistInvitationStatusValue)
  invitationStatus?: WhitelistInvitationStatusValue;

  @IsOptional()
  @IsEnum(WhitelistUserSortField)
  sort: WhitelistUserSortField = WhitelistUserSortField.NAME;

  @IsOptional()
  @IsEnum(SortOrder)
  order: SortOrder = SortOrder.ASC;
}
