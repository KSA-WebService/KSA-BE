import {
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AdminAction,
  AdminActionType,
  FilePurpose,
  FileStatus,
} from '@prisma/client';
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

  const fileFindUniqueMock = jest.fn();

  const transactionFileUpdateManyMock = jest.fn();

  const transactionFileFindUniqueMock = jest.fn();

  const transactionFileFindUniqueOrThrowMock = jest.fn();

  const adminActionLogCreateMock = jest.fn();

  const transactionClientMock = {
    file: {
      updateMany: transactionFileUpdateManyMock,
      findUnique: transactionFileFindUniqueMock,
      findUniqueOrThrow: transactionFileFindUniqueOrThrowMock,
    },
    adminActionLog: {
      create: adminActionLogCreateMock,
    },
  };

  const transactionMock = jest.fn(
    async (
      callback: (transaction: typeof transactionClientMock) => Promise<unknown>,
    ) => callback(transactionClientMock),
  );

  const prismaServiceMock = {
    file: {
      create: fileCreateMock,
      findUnique: fileFindUniqueMock,
    },
    $transaction: transactionMock,
  };

  const supabaseAdminServiceMock = {
    createSignedImageUploadUrl: jest.fn(),
    getPublicImageUrl: jest.fn(),
    getStoredImageInfo: jest.fn(),
    deleteStoredImage: jest.fn(),
  };

  const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

  const otherAdminId = 'a5b922c5-9ca5-4c29-81e6-8faec8fbda54';

  const fileId = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const createdAt = new Date('2026-08-05T03:30:00.000Z');

  const completedAt = new Date('2026-08-04T05:00:00.000Z');

  const storagePath = `post-images/2026/08/${fileId}.png`;

  const fileUrl = `https://project.supabase.co/storage/v1/object/public/public-images/${storagePath}`;

  const pendingFile = {
    id: fileId,
    uploadedBy: adminId,
    originalName: 'notice-image.png',
    storagePath,
    fileUrl,
    contentType: 'image/png',
    fileSize: 204800,
    purpose: FilePurpose.POST_IMAGE,
    status: FileStatus.PENDING,
    createdAt,
    completedAt: null,
    deletedAt: null,
  };

  const completedFile = {
    ...pendingFile,
    status: FileStatus.COMPLETED,
    completedAt,
  };

  const deletedAt = new Date('2026-08-04T05:00:00.000Z');

  const noFileReferences = {
    products: 0,
    contentImages: 0,
    clubImages: 0,
  };

  const pendingDeleteFile = {
    ...pendingFile,
    _count: noFileReferences,
  };

  const completedDeleteFile = {
    ...completedFile,
    _count: noFileReferences,
  };

  const deletedFile = {
    ...completedDeleteFile,
    status: FileStatus.DELETED,
    deletedAt,
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

  it('should verify Storage metadata and complete a pending file', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingFile);

    supabaseAdminServiceMock.getStoredImageInfo.mockResolvedValue({
      size: pendingFile.fileSize,
      contentType: pendingFile.contentType,
    });

    transactionFileUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    transactionFileFindUniqueOrThrowMock.mockResolvedValue(completedFile);

    await expect(service.completeFileUpload(fileId, adminId)).resolves.toEqual({
      fileId,
      originalName: pendingFile.originalName,
      storagePath,
      fileUrl,
      contentType: pendingFile.contentType,
      fileSize: pendingFile.fileSize,
      purpose: pendingFile.purpose,
      status: FileStatus.COMPLETED,
      createdAt,
      completedAt,
    });

    expect(supabaseAdminServiceMock.getStoredImageInfo).toHaveBeenCalledWith(
      storagePath,
    );

    expect(transactionFileUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: fileId,
        uploadedBy: adminId,
        status: FileStatus.PENDING,
        deletedAt: null,
      },
      data: {
        status: FileStatus.COMPLETED,
        completedAt,
      },
    });

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.FILE,
        targetId: fileId,
        action: AdminAction.UPLOAD_FILE,
        metadata: {
          originalName: pendingFile.originalName,
          storagePath,
          contentType: pendingFile.contentType,
          fileSize: pendingFile.fileSize,
          purpose: pendingFile.purpose,
        },
      },
    });
  });

  it('should reject a file that does not exist', async () => {
    fileFindUniqueMock.mockResolvedValue(null);

    await expect(
      service.completeFileUpload(fileId, adminId),
    ).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'F404_FILE_NOT_FOUND',
      },
    });

    expect(supabaseAdminServiceMock.getStoredImageInfo).not.toHaveBeenCalled();

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject completion by another administrator', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingFile);

    await expect(
      service.completeFileUpload(fileId, otherAdminId),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        errorCode: 'F403_FILE_ACCESS_DENIED',
      },
    });

    expect(supabaseAdminServiceMock.getStoredImageInfo).not.toHaveBeenCalled();

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a deleted file', async () => {
    fileFindUniqueMock.mockResolvedValue({
      ...pendingFile,
      status: FileStatus.DELETED,
      deletedAt: new Date('2026-08-05T04:00:00.000Z'),
    });

    await expect(
      service.completeFileUpload(fileId, adminId),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_DELETED',
      },
    });

    expect(supabaseAdminServiceMock.getStoredImageInfo).not.toHaveBeenCalled();

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should return an already completed file without creating another log', async () => {
    fileFindUniqueMock.mockResolvedValue(completedFile);

    await expect(service.completeFileUpload(fileId, adminId)).resolves.toEqual({
      fileId,
      originalName: completedFile.originalName,
      storagePath,
      fileUrl,
      contentType: completedFile.contentType,
      fileSize: completedFile.fileSize,
      purpose: completedFile.purpose,
      status: FileStatus.COMPLETED,
      createdAt,
      completedAt,
    });

    expect(supabaseAdminServiceMock.getStoredImageInfo).not.toHaveBeenCalled();

    expect(transactionMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should keep the file pending when the Storage object does not exist', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingFile);

    supabaseAdminServiceMock.getStoredImageInfo.mockResolvedValue(null);

    await expect(
      service.completeFileUpload(fileId, adminId),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_NOT_UPLOADED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a Storage file with a mismatched size', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingFile);

    supabaseAdminServiceMock.getStoredImageInfo.mockResolvedValue({
      size: pendingFile.fileSize + 1,
      contentType: pendingFile.contentType,
    });

    await expect(
      service.completeFileUpload(fileId, adminId),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_METADATA_MISMATCH',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should reject a Storage file with a mismatched content type', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingFile);

    supabaseAdminServiceMock.getStoredImageInfo.mockResolvedValue({
      size: pendingFile.fileSize,
      contentType: 'image/jpeg',
    });

    await expect(
      service.completeFileUpload(fileId, adminId),
    ).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_METADATA_MISMATCH',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should return an internal error when Storage verification fails', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingFile);

    supabaseAdminServiceMock.getStoredImageInfo.mockRejectedValue(
      new Error('Storage failure'),
    );

    await expect(
      service.completeFileUpload(fileId, adminId),
    ).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'F500_FILE_VERIFICATION_FAILED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should return the completed file when another request completed it first', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingFile);

    supabaseAdminServiceMock.getStoredImageInfo.mockResolvedValue({
      size: pendingFile.fileSize,
      contentType: pendingFile.contentType,
    });

    transactionFileUpdateManyMock.mockResolvedValue({
      count: 0,
    });

    transactionFileFindUniqueMock.mockResolvedValue(completedFile);

    await expect(service.completeFileUpload(fileId, adminId)).resolves.toEqual({
      fileId,
      originalName: completedFile.originalName,
      storagePath,
      fileUrl,
      contentType: completedFile.contentType,
      fileSize: completedFile.fileSize,
      purpose: completedFile.purpose,
      status: FileStatus.COMPLETED,
      createdAt,
      completedAt,
    });

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();

    expect(transactionFileFindUniqueOrThrowMock).not.toHaveBeenCalled();
  });

  it('should delete an unreferenced completed file and create an audit log', async () => {
    fileFindUniqueMock.mockResolvedValue(completedDeleteFile);

    supabaseAdminServiceMock.deleteStoredImage.mockResolvedValue('DELETED');

    transactionFileFindUniqueMock.mockResolvedValue(completedDeleteFile);

    transactionFileUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(service.deleteFile(fileId, adminId)).resolves.toEqual({
      fileId,
      status: FileStatus.DELETED,
      deletedAt,
    });

    expect(supabaseAdminServiceMock.deleteStoredImage).toHaveBeenCalledWith(
      storagePath,
    );

    expect(transactionFileUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: fileId,
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

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.FILE,
        targetId: fileId,
        action: AdminAction.DELETE_FILE,
        metadata: {
          originalName: completedDeleteFile.originalName,
          storagePath: completedDeleteFile.storagePath,
          contentType: completedDeleteFile.contentType,
          fileSize: completedDeleteFile.fileSize,
          purpose: completedDeleteFile.purpose,
          previousStatus: FileStatus.COMPLETED,
        },
      },
    });
  });

  it('should soft-delete a pending file when the Storage object is already missing', async () => {
    fileFindUniqueMock.mockResolvedValue(pendingDeleteFile);

    supabaseAdminServiceMock.deleteStoredImage.mockResolvedValue('NOT_FOUND');

    transactionFileFindUniqueMock.mockResolvedValue(pendingDeleteFile);

    transactionFileUpdateManyMock.mockResolvedValue({
      count: 1,
    });

    adminActionLogCreateMock.mockResolvedValue({
      id: 1,
    });

    await expect(service.deleteFile(fileId, adminId)).resolves.toEqual({
      fileId,
      status: FileStatus.DELETED,
      deletedAt,
    });

    expect(transactionFileUpdateManyMock).toHaveBeenCalledWith({
      where: {
        id: fileId,
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

    expect(adminActionLogCreateMock).toHaveBeenCalledWith({
      data: {
        adminId,
        actionType: AdminActionType.FILE,
        targetId: fileId,
        action: AdminAction.DELETE_FILE,
        metadata: {
          originalName: pendingDeleteFile.originalName,
          storagePath: pendingDeleteFile.storagePath,
          contentType: pendingDeleteFile.contentType,
          fileSize: pendingDeleteFile.fileSize,
          purpose: pendingDeleteFile.purpose,
          previousStatus: FileStatus.PENDING,
        },
      },
    });
  });

  it('should reject a file that does not exist', async () => {
    fileFindUniqueMock.mockResolvedValue(null);

    await expect(service.deleteFile(fileId, adminId)).rejects.toMatchObject({
      status: 404,
      response: {
        errorCode: 'F404_FILE_NOT_FOUND',
      },
    });

    expect(supabaseAdminServiceMock.deleteStoredImage).not.toHaveBeenCalled();

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should return an already deleted file without deleting Storage or creating another log', async () => {
    fileFindUniqueMock.mockResolvedValue(deletedFile);

    await expect(service.deleteFile(fileId, adminId)).resolves.toEqual({
      fileId,
      status: FileStatus.DELETED,
      deletedAt,
    });

    expect(supabaseAdminServiceMock.deleteStoredImage).not.toHaveBeenCalled();

    expect(transactionMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject a file referenced by other entities', async () => {
    fileFindUniqueMock.mockResolvedValue({
      ...completedDeleteFile,
      _count: {
        products: 1,
        contentImages: 2,
        clubImages: 1,
      },
    });

    await expect(service.deleteFile(fileId, adminId)).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_IN_USE',
        data: {
          references: [
            {
              type: 'PRODUCT',
              count: 1,
            },
            {
              type: 'CONTENT_POST',
              count: 2,
            },
            {
              type: 'CLUB',
              count: 1,
            },
          ],
        },
      },
    });

    expect(supabaseAdminServiceMock.deleteStoredImage).not.toHaveBeenCalled();

    expect(transactionMock).not.toHaveBeenCalled();
  });

  it('should not change the database when Storage deletion fails', async () => {
    fileFindUniqueMock.mockResolvedValue(completedDeleteFile);

    supabaseAdminServiceMock.deleteStoredImage.mockRejectedValue(
      new Error('Storage failure'),
    );

    await expect(service.deleteFile(fileId, adminId)).rejects.toMatchObject({
      status: 500,
      response: {
        errorCode: 'F500_FILE_DELETE_FAILED',
      },
    });

    expect(transactionMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should reject deletion when a reference exists during the transaction recheck', async () => {
    fileFindUniqueMock.mockResolvedValue(completedDeleteFile);

    supabaseAdminServiceMock.deleteStoredImage.mockResolvedValue('DELETED');

    transactionFileFindUniqueMock.mockResolvedValue({
      ...completedDeleteFile,
      _count: {
        products: 1,
        contentImages: 0,
        clubImages: 0,
      },
    });

    await expect(service.deleteFile(fileId, adminId)).rejects.toMatchObject({
      status: 409,
      response: {
        errorCode: 'F409_FILE_IN_USE',
      },
    });

    expect(transactionFileUpdateManyMock).not.toHaveBeenCalled();

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });

  it('should return the deleted result when another request deleted the file first', async () => {
    fileFindUniqueMock.mockResolvedValue(completedDeleteFile);

    supabaseAdminServiceMock.deleteStoredImage.mockResolvedValue('DELETED');

    transactionFileFindUniqueMock
      .mockResolvedValueOnce(completedDeleteFile)
      .mockResolvedValueOnce(deletedFile);

    transactionFileUpdateManyMock.mockResolvedValue({
      count: 0,
    });

    await expect(service.deleteFile(fileId, adminId)).resolves.toEqual({
      fileId,
      status: FileStatus.DELETED,
      deletedAt,
    });

    expect(adminActionLogCreateMock).not.toHaveBeenCalled();
  });
});
