import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export enum PublicProductTypeFilter {
  TICKET = 'ticket',
  MERCHANDISE = 'merchandise',
}

export enum PublicProductSort {
  LATEST = 'latest',
  OLDEST = 'oldest',
}

export class ListPublicProductsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 12;

  @IsOptional()
  @IsEnum(PublicProductTypeFilter)
  productType?: PublicProductTypeFilter;

  @IsOptional()
  @IsEnum(PublicProductSort)
  sort: PublicProductSort = PublicProductSort.LATEST;
}
