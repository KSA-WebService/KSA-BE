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

import { ContentPostCategoryValue } from './create-content-post.dto';

export enum AdminContentPostStatusValue {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

export enum AdminPostSortValue {
  LATEST = 'latest',
  OLDEST = 'oldest',
}

export class GetAdminPostListQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MaxLength(255)
  keyword?: string;

  @IsOptional()
  @IsEnum(ContentPostCategoryValue)
  category?: ContentPostCategoryValue;

  @IsOptional()
  @IsEnum(AdminContentPostStatusValue)
  status?: AdminContentPostStatusValue;

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
  size = 10;

  @IsOptional()
  @IsEnum(AdminPostSortValue)
  sort: AdminPostSortValue = AdminPostSortValue.LATEST;
}
