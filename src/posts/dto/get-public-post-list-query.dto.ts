import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum PublicContentPostCategoryValue {
  EVENT = 'event',
  CAREER = 'career',
  PARTNERSHIP = 'partnership',
  CO_PURCHASE = 'co_purchase',
  ANNOUNCEMENT = 'announcement',
  ALUMNI = 'alumni',
}

export enum PublicPostPeriodValue {
  ALL = 'all',
  UPCOMING = 'upcoming',
  PAST = 'past',
  UNDATED = 'undated',
}

export enum PublicPostSortValue {
  LATEST = 'latest',
  OLDEST = 'oldest',
}

export class GetPublicPostListQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  keyword?: string;

  @IsOptional()
  @IsEnum(PublicContentPostCategoryValue)
  category?: PublicContentPostCategoryValue;

  @IsOptional()
  @IsEnum(PublicPostPeriodValue)
  period: PublicPostPeriodValue = PublicPostPeriodValue.ALL;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @IsOptional()
  @IsEnum(PublicPostSortValue)
  sort: PublicPostSortValue = PublicPostSortValue.LATEST;
}
