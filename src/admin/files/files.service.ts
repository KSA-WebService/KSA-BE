import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { FilePurpose, FileStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { extname } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../auth/supabase-admin.service';
import { CreateImageUploadUrlDto } from './dto/create-image-upload-url.dto';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const SIGNED_UPLOAD_VALIDITY_MS = 2 * 60 * 60 * 1000;

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

@Injectable()
export class FilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseAdminService: SupabaseAdminService,
  ) {}

  async createImageUploadUrl(dto: CreateImageUploadUrlDto, adminId: string) {
    const imageTypeRule = IMAGE_TYPE_RULES[dto.contentType];

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

    const folder = PURPOSE_FOLDERS[dto.purpose];

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
        purpose: dto.purpose,
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
      purpose: file.purpose,
      status: file.status,
      expiresAt: new Date(file.createdAt.getTime() + SIGNED_UPLOAD_VALIDITY_MS),
      createdAt: file.createdAt,
    };
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
}
