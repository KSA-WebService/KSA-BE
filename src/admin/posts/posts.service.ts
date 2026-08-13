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
  Prisma,
  PublicationStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import {
  ContentPostCategoryValue,
  CreateContentPostDto,
  CreateContentPostStatus,
} from './dto/create-content-post.dto';

import {
  AdminContentPostStatusValue,
  AdminPostSortValue,
  GetAdminPostListQueryDto,
} from './dto/get-admin-post-list-query.dto';

import { UpdateContentPostDto } from './dto/update-content-post.dto';

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

const CATEGORY_VALUE_MAP: Record<
  ContentPostCategoryType,
  ContentPostCategoryValue
> = {
  [ContentPostCategoryType.EVENT]: ContentPostCategoryValue.EVENT,
  [ContentPostCategoryType.CAREER]: ContentPostCategoryValue.CAREER,
  [ContentPostCategoryType.PARTNERSHIP]: ContentPostCategoryValue.PARTNERSHIP,
  [ContentPostCategoryType.CO_PURCHASE]: ContentPostCategoryValue.CO_PURCHASE,
  [ContentPostCategoryType.ANNOUNCEMENT]: ContentPostCategoryValue.ANNOUNCEMENT,
  [ContentPostCategoryType.ALUMNI]: ContentPostCategoryValue.ALUMNI,
};

type ContentPostStatusValue = CreateContentPostStatus | 'hidden';

const STATUS_VALUE_MAP: Record<PublicationStatus, ContentPostStatusValue> = {
  [PublicationStatus.DRAFT]: CreateContentPostStatus.DRAFT,
  [PublicationStatus.PUBLISHED]: CreateContentPostStatus.PUBLISHED,
  [PublicationStatus.HIDDEN]: 'hidden',
};

const ADMIN_STATUS_FILTER_MAP: Record<
  AdminContentPostStatusValue,
  PublicationStatus
> = {
  [AdminContentPostStatusValue.DRAFT]: PublicationStatus.DRAFT,
  [AdminContentPostStatusValue.PUBLISHED]: PublicationStatus.PUBLISHED,
  [AdminContentPostStatusValue.HIDDEN]: PublicationStatus.HIDDEN,
};

const MAX_SERIALIZABLE_TRANSACTION_RETRIES = 3;

const POST_DETAIL_SELECT = {
  id: true,
  title: true,
  content: true,
  membersOnly: true,
  status: true,
  eventStartAt: true,
  eventEndAt: true,
  showOnCalendar: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    orderBy: {
      category: 'asc',
    },
    select: {
      category: true,
    },
  },
  images: {
    orderBy: {
      sortOrder: 'asc',
    },
    select: {
      id: true,
      fileId: true,
      sortOrder: true,
      file: {
        select: {
          originalName: true,
          fileUrl: true,
          contentType: true,
          fileSize: true,
        },
      },
    },
  },
  author: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ContentPostSelect;

const POST_LIST_SELECT = {
  id: true,
  title: true,
  membersOnly: true,
  status: true,
  eventStartAt: true,
  eventEndAt: true,
  showOnCalendar: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  categories: {
    orderBy: {
      category: 'asc',
    },
    select: {
      category: true,
    },
  },
  images: {
    orderBy: {
      sortOrder: 'asc',
    },
    take: 1,
    select: {
      fileId: true,
      file: {
        select: {
          originalName: true,
          fileUrl: true,
        },
      },
    },
  },
  author: {
    select: {
      id: true,
      name: true,
    },
  },
} satisfies Prisma.ContentPostSelect;

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
      return await this.runSerializableTransaction(async (transaction) => {
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
  async updatePost(postId: string, dto: UpdateContentPostDto, adminId: string) {
    const updatedFields = Object.entries(dto)
      .filter(([, value]) => value !== undefined)
      .map(([key]) => key);

    if (updatedFields.length === 0) {
      throw new BadRequestException({
        errorCode: 'C400_CONTENT_POST_UPDATE_REQUIRED',
        message: 'At least one field must be provided',
      });
    }

    try {
      return await this.runSerializableTransaction(async (tx) => {
        const existingPost = await tx.contentPost.findFirst({
          where: {
            id: postId,
            deletedAt: null,
          },
          select: {
            id: true,
            status: true,
            publishedAt: true,
            eventStartAt: true,
            eventEndAt: true,
            showOnCalendar: true,
          },
        });

        if (!existingPost) {
          throw new NotFoundException({
            errorCode: 'C404_CONTENT_POST_NOT_FOUND',
            message: 'Content post not found',
          });
        }

        const finalEventStartAt =
          dto.eventStartAt === undefined
            ? existingPost.eventStartAt
            : dto.eventStartAt === null
              ? null
              : new Date(dto.eventStartAt);

        const finalEventEndAt =
          dto.eventEndAt === undefined
            ? existingPost.eventEndAt
            : dto.eventEndAt === null
              ? null
              : new Date(dto.eventEndAt);

        const finalShowOnCalendar =
          dto.showOnCalendar === undefined
            ? existingPost.showOnCalendar
            : dto.showOnCalendar;

        this.validateSchedule(
          finalEventStartAt,
          finalEventEndAt,
          finalShowOnCalendar,
        );

        if (dto.imageFileIds !== undefined) {
          const files = await tx.file.findMany({
            where: {
              id: {
                in: dto.imageFileIds,
              },
            },
            select: {
              id: true,
              status: true,
              purpose: true,
              deletedAt: true,
            },
          });

          const fileMap = new Map(files.map((file) => [file.id, file]));

          for (const fileId of dto.imageFileIds) {
            const file = fileMap.get(fileId);

            if (!file) {
              throw new NotFoundException({
                errorCode: 'F404_FILE_NOT_FOUND',
                message: 'File not found',
                data: {
                  fileId,
                },
              });
            }

            if (
              file.status !== FileStatus.COMPLETED ||
              file.deletedAt !== null
            ) {
              throw new ConflictException({
                errorCode: 'F409_FILE_NOT_AVAILABLE',
                message: 'File is not available',
                data: {
                  fileId,
                },
              });
            }

            if (file.purpose !== FilePurpose.POST_IMAGE) {
              throw new ConflictException({
                errorCode: 'F409_FILE_PURPOSE_MISMATCH',
                message: 'File purpose does not match',
                data: {
                  fileId,
                },
              });
            }
          }
        }

        const finalStatus =
          dto.status === undefined
            ? existingPost.status
            : ADMIN_STATUS_FILTER_MAP[dto.status];

        const shouldSetPublishedAt =
          existingPost.publishedAt === null &&
          finalStatus === PublicationStatus.PUBLISHED;

        const updateData: Prisma.ContentPostUpdateInput = {
          ...(dto.title !== undefined
            ? {
                title: dto.title,
              }
            : {}),
          ...(dto.content !== undefined
            ? {
                content: dto.content,
              }
            : {}),
          ...(dto.membersOnly !== undefined
            ? {
                membersOnly: dto.membersOnly,
              }
            : {}),
          ...(dto.status !== undefined
            ? {
                status: ADMIN_STATUS_FILTER_MAP[dto.status],
              }
            : {}),
          ...(dto.eventStartAt !== undefined
            ? {
                eventStartAt: finalEventStartAt,
              }
            : {}),
          ...(dto.eventEndAt !== undefined
            ? {
                eventEndAt: finalEventEndAt,
              }
            : {}),
          ...(dto.showOnCalendar !== undefined
            ? {
                showOnCalendar: dto.showOnCalendar,
              }
            : {}),
          ...(shouldSetPublishedAt
            ? {
                publishedAt: new Date(),
              }
            : {}),
        };

        const updatedPost = await tx.contentPost.update({
          where: {
            id: postId,
          },
          data: updateData,
          select: {
            id: true,
            status: true,
            publishedAt: true,
            updatedAt: true,
          },
        });

        if (dto.categories !== undefined) {
          await tx.contentPostCategory.deleteMany({
            where: {
              contentPostId: postId,
            },
          });

          await tx.contentPostCategory.createMany({
            data: dto.categories.map((category) => ({
              contentPostId: postId,
              category: CATEGORY_MAP[category],
            })),
          });
        }

        if (dto.imageFileIds !== undefined) {
          await tx.contentImage.deleteMany({
            where: {
              contentPostId: postId,
            },
          });

          if (dto.imageFileIds.length > 0) {
            await tx.contentImage.createMany({
              data: dto.imageFileIds.map((fileId, index) => ({
                contentPostId: postId,
                fileId,
                sortOrder: index + 1,
              })),
            });
          }
        }

        await tx.adminActionLog.create({
          data: {
            adminId,
            action: AdminAction.UPDATE_CONTENT_POST,
            actionType: AdminActionType.CONTENT,
            targetId: postId,
            metadata: {
              updatedFields,
              status: updatedPost.status,
            },
          },
        });

        return {
          postId: updatedPost.id,
          status: STATUS_VALUE_MAP[updatedPost.status],
          publishedAt: updatedPost.publishedAt,
          updatedAt: updatedPost.updatedAt,
        };
      });
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'C500_CONTENT_POST_UPDATE_FAILED',
        message: 'Failed to update the content post',
      });
    }
  }

  async getPostList(query: GetAdminPostListQueryDto) {
    const { keyword, category, status, page, limit, sort } = query;

    const normalizedKeyword = keyword?.trim() || undefined;

    const where: Prisma.ContentPostWhereInput = {
      deletedAt: null,
      ...(normalizedKeyword
        ? {
            title: {
              contains: normalizedKeyword,
              mode: 'insensitive',
            },
          }
        : {}),
      ...(category
        ? {
            categories: {
              some: {
                category: CATEGORY_MAP[category],
              },
            },
          }
        : {}),
      ...(status
        ? {
            status: ADMIN_STATUS_FILTER_MAP[status],
          }
        : {}),
    };

    try {
      const [posts, totalCount] = await this.prisma.$transaction([
        this.prisma.contentPost.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: [
            {
              createdAt: sort === AdminPostSortValue.OLDEST ? 'asc' : 'desc',
            },
            {
              id: 'asc',
            },
          ],
          select: POST_LIST_SELECT,
        }),
        this.prisma.contentPost.count({
          where,
        }),
      ]);

      return {
        items: posts.map((post) => {
          const representativeImage = post.images[0];

          return {
            postId: post.id,
            title: post.title,
            categories: post.categories.map(
              ({ category: postCategory }) => CATEGORY_VALUE_MAP[postCategory],
            ),
            membersOnly: post.membersOnly,
            status: STATUS_VALUE_MAP[post.status],
            eventStartAt: post.eventStartAt,
            eventEndAt: post.eventEndAt,
            showOnCalendar: post.showOnCalendar,
            representativeImage: representativeImage
              ? {
                  fileId: representativeImage.fileId,
                  originalName: representativeImage.file.originalName,
                  fileUrl: representativeImage.file.fileUrl,
                }
              : null,
            author: {
              userId: post.author.id,
              name: post.author.name,
            },
            publishedAt: post.publishedAt,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
          };
        }),
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'C500_CONTENT_POST_LIST_FETCH_FAILED',
        message: 'Failed to retrieve the content post list',
      });
    }
  }

  async getPostDetail(postId: string) {
    try {
      const post = await this.prisma.contentPost.findFirst({
        where: {
          id: postId,
          deletedAt: null,
        },
        select: POST_DETAIL_SELECT,
      });

      if (!post) {
        throw new NotFoundException({
          errorCode: 'C404_CONTENT_POST_NOT_FOUND',
          message: 'Content post not found',
        });
      }

      return {
        postId: post.id,
        title: post.title,
        content: post.content,
        categories: post.categories.map(
          ({ category }) => CATEGORY_VALUE_MAP[category],
        ),
        membersOnly: post.membersOnly,
        status: STATUS_VALUE_MAP[post.status],
        eventStartAt: post.eventStartAt,
        eventEndAt: post.eventEndAt,
        showOnCalendar: post.showOnCalendar,
        images: post.images.map((image) => ({
          contentImageId: image.id,
          fileId: image.fileId,
          originalName: image.file.originalName,
          fileUrl: image.file.fileUrl,
          contentType: image.file.contentType,
          fileSize: image.file.fileSize,
          sortOrder: image.sortOrder,
        })),
        author: {
          userId: post.author.id,
          name: post.author.name,
        },
        publishedAt: post.publishedAt,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      };
    } catch (error: unknown) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'C500_CONTENT_POST_FETCH_FAILED',
        message: 'Failed to retrieve the content post',
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
            errorCode: 'C409_CONTENT_POST_CONCURRENT_UPDATE',
            message:
              'Content post could not be saved due to a concurrent update. Please try again',
          });
        }
      }
    }

    throw new ConflictException({
      errorCode: 'C409_CONTENT_POST_CONCURRENT_UPDATE',
      message:
        'Content post could not be saved due to a concurrent update. Please try again',
    });
  }
}
