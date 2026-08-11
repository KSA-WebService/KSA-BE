import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class GetAdminActionLogParamDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  logId!: number;
}
