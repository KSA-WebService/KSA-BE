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

export enum AdminProductTypeFilter {
  TICKET = 'ticket',
  MERCHANDISE = 'merchandise',
}

export enum AdminProductPublicationStatusFilter {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  HIDDEN = 'hidden',
}

export enum AdminProductAvailabilityStatusFilter {
  AVAILABLE = 'available',
  UNAVAILABLE = 'unavailable',
}

export enum AdminProductSort {
  LATEST = 'latest',
  OLDEST = 'oldest',
}

export class ListProductsQueryDto {
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

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsEnum(AdminProductTypeFilter)
  productType?: AdminProductTypeFilter;

  @IsOptional()
  @IsEnum(AdminProductPublicationStatusFilter)
  publicationStatus?: AdminProductPublicationStatusFilter;

  @IsOptional()
  @IsEnum(AdminProductAvailabilityStatusFilter)
  availabilityStatus?: AdminProductAvailabilityStatusFilter;

  @IsOptional()
  @IsEnum(AdminProductSort)
  sort: AdminProductSort = AdminProductSort.LATEST;
}
