import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  IsOptional,
} from 'class-validator';

export enum CreateProductTypeValue {
  TICKET = 'ticket',
  MERCHANDISE = 'merchandise',
}

export enum CreateProductPublicationStatusValue {
  DRAFT = 'draft',
  PUBLISHED = 'published',
}

export class CreateProductDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  productName!: string;

  @IsEnum(CreateProductTypeValue)
  productType!: CreateProductTypeValue;

  @IsInt()
  @Min(1)
  tokenPrice!: number;

  @IsInt()
  @Min(0)
  stockQuantity!: number;

  @IsOptional()
  @IsBoolean()
  isOrderable?: boolean = true;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();

    return trimmed.length > 0 ? trimmed : null;
  })
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @IsOptional()
  @IsUUID('4')
  imageFileId?: string | null;

  @IsEnum(CreateProductPublicationStatusValue)
  publicationStatus!: CreateProductPublicationStatusValue;
}
