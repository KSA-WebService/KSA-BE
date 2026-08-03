import { Transform, Type, type TransformFnParams } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SaveTokenGrantItemDto {
  @IsUUID('4')
  userId!: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  grantedAmount!: number;

  @Transform((params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  reason!: string;
}

export class SaveTokenGrantsDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ArrayUnique((grant: SaveTokenGrantItemDto) => grant.userId, {
    message: 'grants must not contain duplicate userId values',
  })
  @ValidateNested({
    each: true,
  })
  @Type(() => SaveTokenGrantItemDto)
  grants!: SaveTokenGrantItemDto[];
}
