import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FilePurpose, FileStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { SupabaseAdminService } from '../../auth/supabase-admin.service';
import { FilesService } from './files.service';

jest.mock('crypto', () => {
  const actualCrypto = jest.requireActual<typeof import('crypto')>('crypto');

  return {
    ...actualCrypto,
    randomUUID: jest.fn(),
  };
});

const randomUUIDMock = jest.mocked(randomUUID);

describe('FilesService', () => {
  let service: FilesService;

  const fileCreateMock = jest.fn();

  const prismaServiceMock = {
    file: {
      create: fileCreateMock,
    },
  };

  const supabaseAdminServiceMock = {
    createSignedImageUploadUrl: jest.fn(),
    getPublicImageUrl: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    jest.setSystemTime(new Date('2026-08-04T05:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
        {
          provide: SupabaseAdminService,
          useValue: supabaseAdminServiceMock,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('should create a signed upload URL and pending file record', async () => {
    const fileId = '9f3a2b1c-3333-4d22-8e20-def987654321' as ReturnType<
      typeof randomUUID
    >;
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const createdAt = new Date('2026-08-04T05:00:00.000Z');

    const storagePath = `post-images/2026/08/${fileId}.png`;

    const publicUrl = `https://project.supabase.co/storage/v1/object/public/public-images/${storagePath}`;

    randomUUIDMock.mockReturnValue(fileId);

    supabaseAdminServiceMock.createSignedImageUploadUrl.mockResolvedValue({
      signedUrl: 'signed-upload-url',
      token: 'signed-upload-token',
    });

    supabaseAdminServiceMock.getPublicImageUrl.mockReturnValue(publicUrl);

    fileCreateMock.mockResolvedValue({
      id: fileId,
      originalName: 'notice-image.png',
      storagePath,
      contentType: 'image/png',
      fileSize: 204800,
      purpose: FilePurpose.POST_IMAGE,
      status: FileStatus.PENDING,
      createdAt,
    });

    await expect(
      service.createImageUploadUrl(
        {
          originalName: 'notice-image.png',
          contentType: 'image/png',
          fileSize: 204800,
          purpose: FilePurpose.POST_IMAGE,
        },
        adminId,
      ),
    ).resolves.toEqual({
      fileId,
      originalName: 'notice-image.png',
      storagePath,
      uploadUrl: 'signed-upload-url',
      uploadToken: 'signed-upload-token',
      contentType: 'image/png',
      fileSize: 204800,
      purpose: FilePurpose.POST_IMAGE,
      status: FileStatus.PENDING,
      expiresAt: new Date('2026-08-04T07:00:00.000Z'),
      createdAt,
    });

    expect(
      supabaseAdminServiceMock.createSignedImageUploadUrl,
    ).toHaveBeenCalledWith(storagePath);

    expect(fileCreateMock).toHaveBeenCalledWith({
      data: {
        id: fileId,
        uploadedBy: adminId,
        originalName: 'notice-image.png',
        storagePath,
        fileUrl: publicUrl,
        contentType: 'image/png',
        fileSize: 204800,
        purpose: FilePurpose.POST_IMAGE,
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
  });

  it('should reject an unsupported image type', async () => {
    await expect(
      service.createImageUploadUrl(
        {
          originalName: 'image.gif',
          contentType: 'image/gif',
          fileSize: 204800,
          purpose: FilePurpose.POST_IMAGE,
        },
        'admin-id',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(fileCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a file larger than 5 MB', async () => {
    await expect(
      service.createImageUploadUrl(
        {
          originalName: 'image.png',
          contentType: 'image/png',
          fileSize: 5 * 1024 * 1024 + 1,
          purpose: FilePurpose.POST_IMAGE,
        },
        'admin-id',
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'F400_FILE_TOO_LARGE',
      },
    });
  });

  it('should reject a mismatched extension', async () => {
    await expect(
      service.createImageUploadUrl(
        {
          originalName: 'image.jpg',
          contentType: 'image/png',
          fileSize: 204800,
          purpose: FilePurpose.POST_IMAGE,
        },
        'admin-id',
      ),
    ).rejects.toMatchObject({
      status: 400,
      response: {
        errorCode: 'F400_INVALID_FILE_NAME',
      },
    });
  });

  it('should not create a file record when signed URL creation fails', async () => {
    supabaseAdminServiceMock.createSignedImageUploadUrl.mockRejectedValue(
      new Error('Storage failure'),
    );

    await expect(
      service.createImageUploadUrl(
        {
          originalName: 'image.webp',
          contentType: 'image/webp',
          fileSize: 204800,
          purpose: FilePurpose.GENERAL_IMAGE,
        },
        'admin-id',
      ),
    ).rejects.toBeInstanceOf(InternalServerErrorException);

    expect(fileCreateMock).not.toHaveBeenCalled();
  });
});
