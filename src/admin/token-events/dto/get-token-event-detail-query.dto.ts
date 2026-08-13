import { Transform, Type, type TransformFnParams } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TokenGrantStatusValue } from '../../../common/constants/token-api-values';

export class GetTokenEventDetailQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @Transform((params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    if (typeof value !== 'string') {
      return value;
    }

    const keyword = value.trim();

    return keyword.length > 0 ? keyword : undefined;
  })
  @IsOptional()
  @IsString()
  keyword?: string;

  @IsEnum(TokenGrantStatusValue)
  grantStatus = TokenGrantStatusValue.ALL;
}
