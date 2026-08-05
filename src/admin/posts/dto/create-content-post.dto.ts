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
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export enum ContentPostCategoryValue {
  EVENT = 'event',
  CAREER = 'career',
  PARTNERSHIP = 'partnership',
  CO_PURCHASE = 'co_purchase',
  ANNOUNCEMENT = 'announcement',
  ALUMNI = 'alumni',
}

export enum CreateContentPostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export class CreateContentPostDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  content?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @ArrayUnique()
  @IsEnum(ContentPostCategoryValue, {
    each: true,
  })
  categories!: ContentPostCategoryValue[];

  @IsOptional()
  @IsBoolean()
  membersOnly?: boolean;

  @IsEnum(CreateContentPostStatus)
  status!: CreateContentPostStatus;

  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'eventStartAt must include Z or a UTC offset',
  })
  eventStartAt?: string | null;

  @IsOptional()
  @IsISO8601({
    strict: true,
    strictSeparator: true,
  })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/, {
    message: 'eventEndAt must include Z or a UTC offset',
  })
  eventEndAt?: string | null;

  @IsOptional()
  @IsBoolean()
  showOnCalendar?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @ArrayUnique()
  @IsUUID('4', {
    each: true,
  })
  imageFileIds?: string[];
}
