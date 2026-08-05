import { Test, TestingModule } from '@nestjs/testing';
import { FilePurpose, FileStatus } from '@prisma/client';
import { Request } from 'express';
import { AdminGuard } from '../../auth/admin.guard';
import { SupabaseAuthGuard } from '../../auth/supabase-auth.guard';
import { CreateImageUploadUrlDto } from './dto/create-image-upload-url.dto';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

type AuthenticatedRequest = Request & {
  user: {
    id: string;
  };
};

describe('FilesController', () => {
  let controller: FilesController;

  const filesServiceMock = {
    createImageUploadUrl: jest.fn(),
    completeFileUpload: jest.fn(),
    deleteFile: jest.fn(),
  };

  const guardMock = {
    canActivate: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleBuilder = Test.createTestingModule({
      controllers: [FilesController],
      providers: [
        {
          provide: FilesService,
          useValue: filesServiceMock,
        },
      ],
    });

    moduleBuilder.overrideGuard(SupabaseAuthGuard).useValue(guardMock);

    moduleBuilder.overrideGuard(AdminGuard).useValue(guardMock);

    const module: TestingModule = await moduleBuilder.compile();

    controller = module.get<FilesController>(FilesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should pass image metadata and admin ID to the service', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const dto: CreateImageUploadUrlDto = {
      originalName: 'notice-image.png',
      contentType: 'image/png',
      fileSize: 204800,
      purpose: FilePurpose.POST_IMAGE,
    };

    const expected = {
      fileId: '9f3a2b1c-3333-4d22-8e20-def987654321',
      originalName: 'notice-image.png',
      storagePath:
        'post-images/2026/08/9f3a2b1c-3333-4d22-8e20-def987654321.png',
      uploadUrl: 'signed-url',
      uploadToken: 'signed-token',
      contentType: 'image/png',
      fileSize: 204800,
      purpose: FilePurpose.POST_IMAGE,
      status: FileStatus.PENDING,
      expiresAt: new Date('2026-08-04T07:00:00.000Z'),
      createdAt: new Date('2026-08-04T05:00:00.000Z'),
    };

    filesServiceMock.createImageUploadUrl.mockResolvedValue(expected);

    const request = {
      user: {
        id: adminId,
      },
    } as AuthenticatedRequest;

    await expect(
      controller.createImageUploadUrl(dto, request),
    ).resolves.toEqual(expected);

    expect(filesServiceMock.createImageUploadUrl).toHaveBeenCalledWith(
      dto,
      adminId,
    );
  });

  it('should pass the file ID and admin ID to the completion service', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const fileId = '9f3a2b1c-3333-4d22-8e20-def987654321';

    const expected = {
      fileId,
      originalName: 'notice-image.png',
      storagePath: `post-images/2026/08/${fileId}.png`,
      fileUrl: `https://project.supabase.co/storage/v1/object/public/public-images/post-images/2026/08/${fileId}.png`,
      contentType: 'image/png',
      fileSize: 204800,
      purpose: FilePurpose.POST_IMAGE,
      status: FileStatus.COMPLETED,
      createdAt: new Date('2026-08-05T03:30:00.000Z'),
      completedAt: new Date('2026-08-05T03:32:00.000Z'),
    };

    filesServiceMock.completeFileUpload.mockResolvedValue(expected);

    const request = {
      user: {
        id: adminId,
      },
    } as AuthenticatedRequest;

    await expect(
      controller.completeFileUpload(
        {
          fileId,
        },
        request,
      ),
    ).resolves.toEqual(expected);

    expect(filesServiceMock.completeFileUpload).toHaveBeenCalledWith(
      fileId,
      adminId,
    );
  });

  it('should pass the file ID and admin ID to the deletion service', async () => {
    const adminId = 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53';

    const fileId = '9f3a2b1c-3333-4d22-8e20-def987654321';

    const deletedAt = new Date('2026-08-04T05:00:00.000Z');

    const expected = {
      fileId,
      status: FileStatus.DELETED,
      deletedAt,
    };

    filesServiceMock.deleteFile.mockResolvedValue(expected);

    const request = {
      user: {
        id: adminId,
      },
    } as AuthenticatedRequest;

    await expect(controller.deleteFile(fileId, request)).resolves.toEqual(
      expected,
    );

    expect(filesServiceMock.deleteFile).toHaveBeenCalledWith(fileId, adminId);
  });
});
