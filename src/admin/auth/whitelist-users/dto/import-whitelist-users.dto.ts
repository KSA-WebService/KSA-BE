import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
} from 'class-validator';

export enum WhitelistImportDuplicatePolicy {
  SKIP = 'skip',
  FAIL = 'fail',
  UPDATE = 'update',
}

export enum ImportRowStatusValue {
  CREATED = 'created',
  UPDATED = 'updated',
  SKIPPED = 'skipped',
  FAILED = 'failed',
}

export class ImportWhitelistUsersDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsEnum(WhitelistImportDuplicatePolicy)
  onDuplicate: WhitelistImportDuplicatePolicy =
    WhitelistImportDuplicatePolicy.SKIP;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  users!: unknown[];
}

export interface ImportRowResult {
  rowIndex: number;
  email: string;
  studentNumber: string;
  status: ImportRowStatusValue;
  whitelistUserId: string | null;
  errorMessage: string | null;
}

export interface ImportWhitelistUsersResponse {
  totalCount: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: ImportRowResult[];
}
