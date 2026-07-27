import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
} from 'class-validator';

export enum WhitelistImportDuplicatePolicy {
  SKIP = 'SKIP',
  FAIL = 'FAIL',
  UPDATE = 'UPDATE',
}

export class ImportWhitelistUsersDto {
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsEnum(WhitelistImportDuplicatePolicy)
  onDuplicate: WhitelistImportDuplicatePolicy =
    WhitelistImportDuplicatePolicy.SKIP;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  users!: unknown[];
}

export type ImportRowStatus =
  | 'CREATED'
  | 'UPDATED'
  | 'SKIPPED'
  | 'FAILED';

export interface ImportRowResult {
  rowIndex: number;
  email: string;
  studentNumber: string;
  status: ImportRowStatus;
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
