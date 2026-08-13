import { FilePurpose, FileStatus } from '@prisma/client';

export enum FilePurposeValue {
  POST_IMAGE = 'post_image',
  PRODUCT_IMAGE = 'product_image',
  CLUB_IMAGE = 'club_image',
  GENERAL_IMAGE = 'general_image',
}

export enum FileStatusValue {
  PENDING = 'pending',
  COMPLETED = 'completed',
  DELETED = 'deleted',
}

export enum FileReferenceTypeValue {
  PRODUCT = 'product',
  CONTENT_POST = 'content_post',
  CLUB = 'club',
}

export const FILE_PURPOSE_VALUE_MAP: Record<FilePurpose, FilePurposeValue> = {
  [FilePurpose.POST_IMAGE]: FilePurposeValue.POST_IMAGE,
  [FilePurpose.PRODUCT_IMAGE]: FilePurposeValue.PRODUCT_IMAGE,
  [FilePurpose.CLUB_IMAGE]: FilePurposeValue.CLUB_IMAGE,
  [FilePurpose.GENERAL_IMAGE]: FilePurposeValue.GENERAL_IMAGE,
};

export const FILE_PURPOSE_PRISMA_MAP: Record<FilePurposeValue, FilePurpose> = {
  [FilePurposeValue.POST_IMAGE]: FilePurpose.POST_IMAGE,
  [FilePurposeValue.PRODUCT_IMAGE]: FilePurpose.PRODUCT_IMAGE,
  [FilePurposeValue.CLUB_IMAGE]: FilePurpose.CLUB_IMAGE,
  [FilePurposeValue.GENERAL_IMAGE]: FilePurpose.GENERAL_IMAGE,
};

export const FILE_STATUS_VALUE_MAP: Record<FileStatus, FileStatusValue> = {
  [FileStatus.PENDING]: FileStatusValue.PENDING,
  [FileStatus.COMPLETED]: FileStatusValue.COMPLETED,
  [FileStatus.DELETED]: FileStatusValue.DELETED,
};
