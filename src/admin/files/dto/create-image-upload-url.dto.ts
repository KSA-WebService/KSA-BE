import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsString, MaxLength, MinLength } from 'class-validator';
import { FilePurposeValue } from '../../../common/constants/file-api-values';
export class CreateImageUploadUrlDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  originalName!: string;

  @IsString()
  contentType!: string;

  @IsInt()
  fileSize!: number;

  @IsEnum(FilePurposeValue)
  purpose!: FilePurposeValue;
}
