import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  FilePurpose,
  FileStatus,
  Prisma,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../auth/supabase-admin.service';
import { CreateImageUploadUrlDto } from './dto/create-image-upload-url.dto';
import {
  FILE_PURPOSE_PRISMA_MAP,
  FILE_PURPOSE_VALUE_MAP,
  FILE_STATUS_VALUE_MAP,
  FileReferenceTypeValue,
} from '../../common/constants/file-api-values';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SIGNED_UPLOAD_VALIDITY_MS = 2 * 60 * 60 * 1000;
const MAX_SERIALIZABLE_TRANSACTION_RETRIES = 3;

const PURPOSE_FOLDERS: Record<FilePurpose, string> = {
  [FilePurpose.POST_IMAGE]: 'post-images',
  [FilePurpose.PRODUCT_IMAGE]: 'product-images',
  [FilePurpose.CLUB_IMAGE]: 'club-images',
  [FilePurpose.GENERAL_IMAGE]: 'general-images',
};

type ImageTypeRule = {
  allowedExtensions: string[];
  storageExtension: string;
};

const IMAGE_TYPE_RULES: Record<string, ImageTypeRule> = {
  'image/png': {
    allowedExtensions: ['.png'],
    storageExtension: 'png',
  },
  'image/jpeg': {
    allowedExtensions: ['.jpg', '.jpeg'],
    storageExtension: 'jpg',
  },
  'image/webp': {
    allowedExtensions: ['.webp'],
    storageExtension: 'webp',
  },
};

const COMPLETE_FILE_SELECT = {
  id: true,
  uploadedBy: true,
  originalName: true,
  storagePath: true,
  fileUrl: true,
  contentType: true,
  fileSize: true,
  purpose: true,
  status: true,
  createdAt: true,
  completedAt: true,
  deletedAt: true,
} satisfies Prisma.FileSelect;

type CompleteFileRecord = Prisma.FileGetPayload<{
  select: typeof COMPLETE_FILE_SELECT;
}>;

const DELETE_FILE_SELECT = {
  id: true,
  originalName: true,
  storagePath: true,
  contentType: true,
  fileSize: true,
  purpose: true,
  status: true,
  completedAt: true,
  deletedAt: true,
  _count: {
    select: {
      products: true,
      contentImages: true,
      clubImages: true,
    },
  },
} satisfies Prisma.FileSelect;

type DeleteFileRecord = Prisma.FileGetPayload<{
  select: typeof DELETE_FILE_SELECT;
}>;

type FileReference = {
  type: FileReferenceTypeValue;
  count: number;
};

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdminService: SupabaseAdminService,
  ) {}

  async createImageUploadUrl(dto: CreateImageUploadUrlDto, adminId: string) {
    const imageTypeRule = IMAGE_TYPE_RULES[dto.contentType];

    const prismaPurpose = FILE_PURPOSE_PRISMA_MAP[dto.purpose];

    if (!imageTypeRule) {
      throw new BadRequestException({
        errorCode: 'F400_UNSUPPORTED_IMAGE_TYPE',
        message: 'Unsupported image type',
      });
    }

    this.validateFileSize(dto.fileSize);
    this.validateFileName(dto.originalName, imageTypeRule);

    const fileId = randomUUID();
    const createdAt = new Date();

    const year = String(createdAt.getUTCFullYear());

    const month = String(createdAt.getUTCMonth() + 1).padStart(2, '0');

    const folder = PURPOSE_FOLDERS[prismaPurpose];

    const storagePath = [
      folder,
      year,
      month,
      `${fileId}.${imageTypeRule.storageExtension}`,
    ].join('/');

    let signedUpload: {
      signedUrl: string;
      token: string;
    };

    try {
      signedUpload =
        await this.supabaseAdminService.createSignedImageUploadUrl(storagePath);
    } catch {
      throw new InternalServerErrorException({
        errorCode: 'F500_UPLOAD_URL_CREATION_FAILED',
        message: 'Failed to create an upload URL',
      });
    }

    const fileUrl = this.supabaseAdminService.getPublicImageUrl(storagePath);

    const file = await this.prisma.file.create({
      data: {
        id: fileId,
        uploadedBy: adminId,
        originalName: dto.originalName,
        storagePath,
        fileUrl,
        contentType: dto.contentType,
        fileSize: dto.fileSize,
        purpose: prismaPurpose,
        status: FileStatus.PENDING,
        createdAt,
      },
      select: {
        id: true,
        originalName: true,
        storagePath: true,
        contentType: true,
        fileSize: true,
        purpose: true,
        status: true,
        createdAt: true,
      },
    });

    return {
      fileId: file.id,
      originalName: file.originalName,
      storagePath: file.storagePath,
      uploadUrl: signedUpload.signedUrl,
      uploadToken: signedUpload.token,
      contentType: file.contentType,
      fileSize: file.fileSize,
      purpose: FILE_PURPOSE_VALUE_MAP[file.purpose],
      status: FILE_STATUS_VALUE_MAP[file.status],
      expiresAt: new Date(file.createdAt.getTime() + SIGNED_UPLOAD_VALIDITY_MS),
      createdAt: file.createdAt,
    };
  }

  async completeFileUpload(fileId: string, adminId: string) {
    const file = await this.prisma.file.findUnique({
      where: {
        id: fileId,
      },
      select: COMPLETE_FILE_SELECT,
    });

    if (!file) {
      throw new NotFoundException({
        errorCode: 'F404_FILE_NOT_FOUND',
        message: 'File not found',
      });
    }

    this.ensureFileOwner(file.uploadedBy, adminId);
    this.ensureFileNotDeleted(file);

    if (file.status === FileStatus.COMPLETED) {
      return this.toFileCompletionResponse(file);
    }

    let storedImageInfo: {
      size: number;
      contentType: string;
    } | null;

    try {
      storedImageInfo = await this.supabaseAdminService.getStoredImageInfo(
        file.storagePath,
      );
    } catch {
      throw new InternalServerErrorException({
        errorCode: 'F500_FILE_VERIFICATION_FAILED',
        message: 'Failed to verify the uploaded file',
      });
    }

    if (!storedImageInfo) {
      throw new ConflictException({
        errorCode: 'F409_FILE_NOT_UPLOADED',
        message: 'The file has not been uploaded to Storage',
      });
    }

    const metadataMatches =
      storedImageInfo.size === file.fileSize &&
      storedImageInfo.contentType === file.contentType;

    if (!metadataMatches) {
      throw new ConflictException({
        errorCode: 'F409_FILE_METADATA_MISMATCH',
        message: 'Uploaded file metadata does not match the requested file',
      });
    }

    const completedAt = new Date();

    return this.prisma.$transaction(async (transaction) => {
      const updateResult = await transaction.file.updateMany({
        where: {
          id: file.id,
          uploadedBy: adminId,
          status: FileStatus.PENDING,
          deletedAt: null,
        },
        data: {
          status: FileStatus.COMPLETED,
          completedAt,
        },
      });

      if (updateResult.count === 0) {
        const currentFile = await transaction.file.findUnique({
          where: {
            id: file.id,
          },
          select: COMPLETE_FILE_SELECT,
        });

        if (!currentFile) {
          throw new NotFoundException({
            errorCode: 'F404_FILE_NOT_FOUND',
            message: 'File not found',
          });
        }

        this.ensureFileOwner(currentFile.uploadedBy, adminId);

        this.ensureFileNotDeleted(currentFile);

        if (currentFile.status === FileStatus.COMPLETED) {
          return this.toFileCompletionResponse(currentFile);
        }

        throw new InternalServerErrorException({
          errorCode: 'F500_FILE_COMPLETION_FAILED',
          message: 'Failed to complete the file upload',
        });
      }

      await transaction.adminActionLog.create({
        data: {
          adminId,
          actionType: AdminActionType.FILE,
          targetId: file.id,
          action: AdminAction.UPLOAD_FILE,
          metadata: {
            originalName: file.originalName,
            storagePath: file.storagePath,
            contentType: file.contentType,
            fileSize: file.fileSize,
            purpose: file.purpose,
          },
        },
      });

      const completedFile = await transaction.file.findUniqueOrThrow({
        where: {
          id: file.id,
        },
        select: COMPLETE_FILE_SELECT,
      });

      return this.toFileCompletionResponse(completedFile);
    });
  }

  async deleteFile(fileId: string, adminId: string) {
    let deletionResult: {
      fileId: string;
      storagePath: string;
      deletedAt: Date | null;
    };

    try {
      deletionResult = await this.runSerializableTransaction(async (tx) => {
        const currentFile = await tx.file.findUnique({
          where: {
            id: fileId,
          },
          select: DELETE_FILE_SELECT,
        });

        if (!currentFile) {
          throw new NotFoundException({
            errorCode: 'F404_FILE_NOT_FOUND',
            message: 'File not found',
          });
        }

        /*
         * 이미 DB에서 삭제된 파일이라면 상태를 다시 변경하거나
         * audit log를 추가하지 않는다.
         *
         * Storage cleanup은 transaction 밖에서 다시 시도한다.
         */
        if (this.isFileDeleted(currentFile)) {
          return {
            fileId: currentFile.id,
            storagePath: currentFile.storagePath,
            deletedAt: currentFile.deletedAt,
          };
        }

        /*
         * 실제 삭제 상태 변경 직전에 reference를 최종 확인한다.
         */
        this.ensureFileNotInUse(currentFile);

        const deletedAt = new Date();

        const updateResult = await tx.file.updateMany({
          where: {
            id: currentFile.id,
            status: {
              in: [FileStatus.PENDING, FileStatus.COMPLETED],
            },
            deletedAt: null,
          },
          data: {
            status: FileStatus.DELETED,
            deletedAt,
          },
        });

        if (updateResult.count !== 1) {
          const latestFile = await tx.file.findUnique({
            where: {
              id: currentFile.id,
            },
            select: DELETE_FILE_SELECT,
          });

          if (!latestFile) {
            throw new NotFoundException({
              errorCode: 'F404_FILE_NOT_FOUND',
              message: 'File not found',
            });
          }

          if (this.isFileDeleted(latestFile)) {
            return {
              fileId: latestFile.id,
              storagePath: latestFile.storagePath,
              deletedAt: latestFile.deletedAt,
            };
          }

          throw new InternalServerErrorException({
            errorCode: 'F500_FILE_DELETE_FAILED',
            message: 'Failed to delete the file',
          });
        }

        await tx.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.FILE,
            targetId: currentFile.id,
            action: AdminAction.DELETE_FILE,
            metadata: {
              originalName: currentFile.originalName,
              storagePath: currentFile.storagePath,
              contentType: currentFile.contentType,
              fileSize: currentFile.fileSize,
              purpose: currentFile.purpose,
              previousStatus: currentFile.status,
            },
          },
        });

        return {
          fileId: currentFile.id,
          storagePath: currentFile.storagePath,
          deletedAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'F500_FILE_DELETE_FAILED',
        message: 'Failed to delete the file',
      });
    }

    /*
     * DB에서 논리 삭제가 commit된 뒤 Storage object를 정리한다.
     *
     * 이미 DB에서 DELETED인 파일에 대한 재요청도 이 단계까지 와서
     * Storage cleanup을 다시 시도하므로 cleanup failure를 복구할 수 있다.
     */
    try {
      await this.supabaseAdminService.deleteStoredImage(
        deletionResult.storagePath,
      );
    } catch {
      throw new InternalServerErrorException({
        errorCode: 'F500_FILE_DELETE_FAILED',
        message: 'Failed to delete the file from Storage',
      });
    }

    return this.toFileDeletionResponse({
      id: deletionResult.fileId,
      deletedAt: deletionResult.deletedAt,
    });
  }

  private validateFileSize(fileSize: number): void {
    if (fileSize <= 0) {
      throw new BadRequestException({
        errorCode: 'F400_INVALID_FILE_SIZE',
        message: 'File size must be greater than zero',
      });
    }

    if (fileSize > MAX_IMAGE_SIZE) {
      throw new BadRequestException({
        errorCode: 'F400_FILE_TOO_LARGE',
        message: 'File size must not exceed 5 MB',
      });
    }
  }

  private validateFileName(
    originalName: string,
    imageTypeRule: ImageTypeRule,
  ): void {
    const containsInvalidCharacter =
      this.containsInvalidFileNameCharacter(originalName);

    const extension = extname(originalName).toLowerCase();

    const extensionMatches =
      imageTypeRule.allowedExtensions.includes(extension);

    if (containsInvalidCharacter || !extensionMatches) {
      throw new BadRequestException({
        errorCode: 'F400_INVALID_FILE_NAME',
        message: 'Invalid image file name',
      });
    }
  }

  private containsInvalidFileNameCharacter(fileName: string): boolean {
    return Array.from(fileName).some((character) => {
      if (character === '/' || character === '\\') {
        return true;
      }

      const characterCode = character.charCodeAt(0);

      return characterCode <= 31 || characterCode === 127;
    });
  }

  private ensureFileOwner(uploadedBy: string | null, adminId: string): void {
    if (uploadedBy !== adminId) {
      throw new ForbiddenException({
        errorCode: 'F403_FILE_ACCESS_DENIED',
        message: 'You do not have access to this file',
      });
    }
  }

  private ensureFileNotDeleted(file: CompleteFileRecord): void {
    const isDeleted =
      file.status === FileStatus.DELETED || file.deletedAt !== null;

    if (isDeleted) {
      throw new ConflictException({
        errorCode: 'F409_FILE_DELETED',
        message: 'Deleted files cannot be completed',
      });
    }
  }

  private toFileCompletionResponse(file: CompleteFileRecord) {
    return {
      fileId: file.id,
      originalName: file.originalName,
      storagePath: file.storagePath,
      fileUrl: file.fileUrl,
      contentType: file.contentType,
      fileSize: file.fileSize,
      purpose: FILE_PURPOSE_VALUE_MAP[file.purpose],
      status: FILE_STATUS_VALUE_MAP[file.status],
      createdAt: file.createdAt,
      completedAt: file.completedAt,
    };
  }

  private ensureFileNotInUse(file: DeleteFileRecord): void {
    const references = this.getFileReferences(file);

    if (references.length > 0) {
      throw new ConflictException({
        errorCode: 'F409_FILE_IN_USE',
        message: 'Files currently in use cannot be deleted',
        data: {
          references,
        },
      });
    }
  }

  private getFileReferences(file: DeleteFileRecord): FileReference[] {
    const references: FileReference[] = [];

    if (file._count.products > 0) {
      references.push({
        type: FileReferenceTypeValue.PRODUCT,
        count: file._count.products,
      });
    }

    if (file._count.contentImages > 0) {
      references.push({
        type: FileReferenceTypeValue.CONTENT_POST,
        count: file._count.contentImages,
      });
    }

    if (file._count.clubImages > 0) {
      references.push({
        type: FileReferenceTypeValue.CLUB,
        count: file._count.clubImages,
      });
    }

    return references;
  }

  private isFileDeleted(file: {
    status: FileStatus;
    deletedAt: Date | null;
  }): boolean {
    return file.status === FileStatus.DELETED || file.deletedAt !== null;
  }

  private async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (
      let attempt = 1;
      attempt <= MAX_SERIALIZABLE_TRANSACTION_RETRIES;
      attempt += 1
    ) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error: unknown) {
        const isTransactionConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034';

        if (!isTransactionConflict) {
          throw error;
        }

        if (attempt === MAX_SERIALIZABLE_TRANSACTION_RETRIES) {
          throw new ConflictException({
            errorCode: 'F409_FILE_CONCURRENT_UPDATE',
            message:
              'File could not be deleted due to a concurrent update. Please try again',
          });
        }
      }
    }

    throw new ConflictException({
      errorCode: 'F409_FILE_CONCURRENT_UPDATE',
      message:
        'File could not be deleted due to a concurrent update. Please try again',
    });
  }

  private toFileDeletionResponse(file: { id: string; deletedAt: Date | null }) {
    return {
      fileId: file.id,
      status: FILE_STATUS_VALUE_MAP[FileStatus.DELETED],
      deletedAt: file.deletedAt,
    };
  }
}
