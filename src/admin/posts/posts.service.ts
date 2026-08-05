import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminAction,
  AdminActionType,
  ContentPostCategoryType,
  FilePurpose,
  FileStatus,
  PublicationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  ContentPostCategoryValue,
  CreateContentPostDto,
  CreateContentPostStatus,
} from './dto/create-content-post.dto';

const CATEGORY_MAP: Record<ContentPostCategoryValue, ContentPostCategoryType> =
  {
    [ContentPostCategoryValue.EVENT]: ContentPostCategoryType.EVENT,
    [ContentPostCategoryValue.CAREER]: ContentPostCategoryType.CAREER,
    [ContentPostCategoryValue.PARTNERSHIP]: ContentPostCategoryType.PARTNERSHIP,
    [ContentPostCategoryValue.CO_PURCHASE]: ContentPostCategoryType.CO_PURCHASE,
    [ContentPostCategoryValue.ANNOUNCEMENT]:
      ContentPostCategoryType.ANNOUNCEMENT,
    [ContentPostCategoryValue.ALUMNI]: ContentPostCategoryType.ALUMNI,
  };

const STATUS_MAP: Record<CreateContentPostStatus, PublicationStatus> = {
  [CreateContentPostStatus.DRAFT]: PublicationStatus.DRAFT,
  [CreateContentPostStatus.PUBLISHED]: PublicationStatus.PUBLISHED,
};

type PostImageFile = {
  id: string;
  fileUrl: string;
  status: FileStatus;
  purpose: FilePurpose;
  deletedAt: Date | null;
};

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  async createPost(dto: CreateContentPostDto, adminId: string) {
    const eventStartAt = dto.eventStartAt ? new Date(dto.eventStartAt) : null;

    const eventEndAt = dto.eventEndAt ? new Date(dto.eventEndAt) : null;

    const showOnCalendar = dto.showOnCalendar ?? false;

    this.validateSchedule(eventStartAt, eventEndAt, showOnCalendar);

    const categoryValues = dto.categories.map(
      (category) => CATEGORY_MAP[category],
    );

    const status = STATUS_MAP[dto.status];
    const membersOnly = dto.membersOnly ?? false;
    const imageFileIds = dto.imageFileIds ?? [];
    const publishedAt =
      status === PublicationStatus.PUBLISHED ? new Date() : null;

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const files =
          imageFileIds.length === 0
            ? []
            : await transaction.file.findMany({
                where: {
                  id: {
                    in: imageFileIds,
                  },
                },
                select: {
                  id: true,
                  fileUrl: true,
                  status: true,
                  purpose: true,
                  deletedAt: true,
                },
              });

        this.validateImageFiles(imageFileIds, files);

        const post = await transaction.contentPost.create({
          data: {
            authorId: adminId,
            title: dto.title,
            content: dto.content ?? null,
            status,
            membersOnly,
            publishedAt,
            eventStartAt,
            eventEndAt,
            showOnCalendar,
            categories: {
              create: categoryValues.map((category) => ({
                category,
              })),
            },
            images:
              imageFileIds.length > 0
                ? {
                    create: imageFileIds.map((fileId, index) => ({
                      fileId,
                      sortOrder: index + 1,
                    })),
                  }
                : undefined,
          },
          select: {
            id: true,
            title: true,
            membersOnly: true,
            status: true,
            eventStartAt: true,
            eventEndAt: true,
            showOnCalendar: true,
            publishedAt: true,
            createdAt: true,
          },
        });

        await transaction.adminActionLog.create({
          data: {
            adminId,
            actionType: AdminActionType.CONTENT,
            targetId: post.id,
            action: AdminAction.CREATE_CONTENT_POST,
            metadata: {
              title: post.title,
              categories: categoryValues,
              membersOnly: post.membersOnly,
              status: post.status,
              imageCount: imageFileIds.length,
              showOnCalendar: post.showOnCalendar,
            },
          },
        });

        const filesById = new Map(files.map((file) => [file.id, file]));

        return {
          postId: post.id,
          title: post.title,
          categories: dto.categories,
          membersOnly: post.membersOnly,
          status: dto.status,
          eventStartAt: post.eventStartAt,
          eventEndAt: post.eventEndAt,
          showOnCalendar: post.showOnCalendar,
          images: imageFileIds.map((fileId, index) => {
            const file = filesById.get(fileId);

            return {
              fileId,
              fileUrl: file?.fileUrl ?? null,
              sortOrder: index + 1,
            };
          }),
          publishedAt: post.publishedAt,
          createdAt: post.createdAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'C500_CONTENT_POST_CREATE_FAILED',
        message: 'Failed to create the content post',
      });
    }
  }

  private validateSchedule(
    eventStartAt: Date | null,
    eventEndAt: Date | null,
    showOnCalendar: boolean,
  ): void {
    if (eventEndAt && !eventStartAt) {
      throw new BadRequestException({
        errorCode: 'C400_EVENT_START_REQUIRED',
        message: 'eventStartAt is required when eventEndAt is provided',
      });
    }

    if (eventStartAt && eventEndAt && eventEndAt < eventStartAt) {
      throw new BadRequestException({
        errorCode: 'C400_INVALID_EVENT_PERIOD',
        message: 'eventEndAt cannot be earlier than eventStartAt',
      });
    }

    if (showOnCalendar && !eventStartAt) {
      throw new BadRequestException({
        errorCode: 'C400_CALENDAR_START_REQUIRED',
        message: 'eventStartAt is required when showOnCalendar is true',
      });
    }
  }

  private validateImageFiles(
    imageFileIds: string[],
    files: PostImageFile[],
  ): void {
    const filesById = new Map(files.map((file) => [file.id, file]));

    const missingFileId = imageFileIds.find((fileId) => !filesById.has(fileId));

    if (missingFileId) {
      throw new NotFoundException({
        errorCode: 'F404_FILE_NOT_FOUND',
        message: 'Image file not found',
        data: {
          fileId: missingFileId,
        },
      });
    }

    for (const fileId of imageFileIds) {
      const file = filesById.get(fileId);

      if (!file) {
        continue;
      }

      if (file.status !== FileStatus.COMPLETED || file.deletedAt !== null) {
        throw new ConflictException({
          errorCode: 'F409_FILE_NOT_AVAILABLE',
          message: 'Image file is not available',
          data: {
            fileId,
          },
        });
      }

      if (file.purpose !== FilePurpose.POST_IMAGE) {
        throw new ConflictException({
          errorCode: 'F409_FILE_PURPOSE_MISMATCH',
          message: 'Only POST_IMAGE files can be attached to a content post',
          data: {
            fileId,
          },
        });
      }
    }
  }
}
