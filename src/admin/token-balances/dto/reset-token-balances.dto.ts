import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResetTokenBalancesDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  confirmation!: string;
}
