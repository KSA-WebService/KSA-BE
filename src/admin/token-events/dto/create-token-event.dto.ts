import { Transform, type TransformFnParams } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTokenEventDto {
  @Transform((params: TransformFnParams): unknown => {
    const value: unknown = params.value;

    return typeof value === 'string' ? value.trim() : value;
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  eventName!: string;
}
