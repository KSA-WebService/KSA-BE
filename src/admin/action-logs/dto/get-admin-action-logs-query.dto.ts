import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

const ADMIN_ACTION_LOG_TYPES = [
  'user',
  'whitelist',
  'invitation',
  'content',
  'product',
  'order',
  'token',
  'file',
  'memo',
] as const;

const ADMIN_ACTION_LOG_SORTS = ['latest', 'oldest'] as const;

export type AdminActionLogType = (typeof ADMIN_ACTION_LOG_TYPES)[number];

export type AdminActionLogSort = (typeof ADMIN_ACTION_LOG_SORTS)[number];

export class GetAdminActionLogsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @IsIn(ADMIN_ACTION_LOG_TYPES)
  actionType?: AdminActionLogType;

  @IsOptional()
  @IsUUID('4')
  adminId?: string;

  @IsOptional()
  @IsIn(ADMIN_ACTION_LOG_SORTS)
  sort: AdminActionLogSort = 'latest';
}
