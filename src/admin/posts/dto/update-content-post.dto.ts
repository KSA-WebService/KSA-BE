import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

import { ContentPostCategoryValue } from './create-content-post.dto';
import { AdminContentPostStatusValue } from './get-admin-post-list-query.dto';

const TIMEZONE_SUFFIX_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/;

export class UpdateContentPostDto {
  @ValidateIf((_, value: unknown) => value !== undefined)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsString()
  content?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsEnum(ContentPostCategoryValue, {
    each: true,
  })
  categories?: ContentPostCategoryValue[];

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  membersOnly?: boolean;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsEnum(AdminContentPostStatusValue)
  status?: AdminContentPostStatusValue;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @Matches(TIMEZONE_SUFFIX_PATTERN)
  eventStartAt?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined && value !== null)
  @IsISO8601({ strict: true })
  @Matches(TIMEZONE_SUFFIX_PATTERN)
  eventEndAt?: string | null;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsBoolean()
  showOnCalendar?: boolean;

  @ValidateIf((_, value: unknown) => value !== undefined)
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  imageFileIds?: string[];
}
