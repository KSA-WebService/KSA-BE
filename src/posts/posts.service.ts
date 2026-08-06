import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import {
  ContentPostCategoryType,
  Prisma,
  PublicationStatus,
} from '@prisma/client';

import { PrismaService } from '../prisma/prisma.service';
import {
  GetPublicPostListQueryDto,
  PublicContentPostCategoryValue,
  PublicPostPeriodValue,
  PublicPostSortValue,
} from './dto/get-public-post-list-query.dto';

const CATEGORY_FILTER_MAP: Record<
  PublicContentPostCategoryValue,
  ContentPostCategoryType
> = {
  [PublicContentPostCategoryValue.EVENT]: ContentPostCategoryType.EVENT,
  [PublicContentPostCategoryValue.CAREER]: ContentPostCategoryType.CAREER,
  [PublicContentPostCategoryValue.PARTNERSHIP]:
    ContentPostCategoryType.PARTNERSHIP,
  [PublicContentPostCategoryValue.CO_PURCHASE]:
    ContentPostCategoryType.CO_PURCHASE,
  [PublicContentPostCategoryValue.ANNOUNCEMENT]:
    ContentPostCategoryType.ANNOUNCEMENT,
  [PublicContentPostCategoryValue.ALUMNI]: ContentPostCategoryType.ALUMNI,
};

const CATEGORY_VALUE_MAP: Record<
  ContentPostCategoryType,
  PublicContentPostCategoryValue
> = {
  [ContentPostCategoryType.EVENT]: PublicContentPostCategoryValue.EVENT,
  [ContentPostCategoryType.CAREER]: PublicContentPostCategoryValue.CAREER,
  [ContentPostCategoryType.PARTNERSHIP]:
    PublicContentPostCategoryValue.PARTNERSHIP,
  [ContentPostCategoryType.CO_PURCHASE]:
    PublicContentPostCategoryValue.CO_PURCHASE,
  [ContentPostCategoryType.ANNOUNCEMENT]:
    PublicContentPostCategoryValue.ANNOUNCEMENT,
  [ContentPostCategoryType.ALUMNI]: PublicContentPostCategoryValue.ALUMNI,
};

const PUBLIC_POST_LIST_SELECT = {
  id: true,
  title: true,
  membersOnly: true,
  eventStartAt: true,
  eventEndAt: true,
  publishedAt: true,
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
          fileUrl: true,
        },
      },
    },
  },
} satisfies Prisma.ContentPostSelect;

const PUBLIC_POST_DETAIL_SELECT = {
  id: true,
  title: true,
  content: true,
  membersOnly: true,
  eventStartAt: true,
  eventEndAt: true,
  publishedAt: true,
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
      fileId: true,
      sortOrder: true,
      file: {
        select: {
          fileUrl: true,
        },
      },
    },
  },
} satisfies Prisma.ContentPostSelect;

@Injectable()
export class PublicPostsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPostList(query: GetPublicPostListQueryDto) {
    const { keyword, category, period, page, size, sort } = query;

    const normalizedKeyword = keyword?.trim() || undefined;

    const now = new Date();

    const periodWhere = this.buildPeriodWhere(period, now);

    const where: Prisma.ContentPostWhereInput = {
      status: PublicationStatus.PUBLISHED,
      deletedAt: null,
      ...periodWhere,
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
                category: CATEGORY_FILTER_MAP[category],
              },
            },
          }
        : {}),
    };

    const sortDirection = sort === PublicPostSortValue.OLDEST ? 'asc' : 'desc';

    try {
      const [posts, totalCount] = await this.prisma.$transaction([
        this.prisma.contentPost.findMany({
          where,
          skip: (page - 1) * size,
          take: size,
          orderBy: [
            {
              publishedAt: sortDirection,
            },
            {
              createdAt: sortDirection,
            },
            {
              id: sortDirection,
            },
          ],
          select: PUBLIC_POST_LIST_SELECT,
        }),
        this.prisma.contentPost.count({
          where,
        }),
      ]);

      return {
        posts: posts.map((post) => {
          const representativeImage = post.images[0];

          return {
            postId: post.id,
            title: post.title,
            categories: post.categories.map(
              ({ category: postCategory }) => CATEGORY_VALUE_MAP[postCategory],
            ),
            membersOnly: post.membersOnly,
            eventStartAt: post.eventStartAt,
            eventEndAt: post.eventEndAt,
            representativeImage: representativeImage
              ? {
                  fileId: representativeImage.fileId,
                  fileUrl: representativeImage.file.fileUrl,
                }
              : null,
            publishedAt: post.publishedAt,
          };
        }),
        page,
        size,
        totalCount,
        totalPages: Math.ceil(totalCount / size),
      };
    } catch {
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
          status: PublicationStatus.PUBLISHED,
          deletedAt: null,
        },
        select: PUBLIC_POST_DETAIL_SELECT,
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
        eventStartAt: post.eventStartAt,
        eventEndAt: post.eventEndAt,
        images: post.images.map(({ fileId, sortOrder, file }) => ({
          fileId,
          fileUrl: file.fileUrl,
          sortOrder,
        })),
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException({
        errorCode: 'C500_CONTENT_POST_FETCH_FAILED',
        message: 'Failed to retrieve the content post',
      });
    }
  }

  private buildPeriodWhere(
    period: PublicPostPeriodValue,
    now: Date,
  ): Prisma.ContentPostWhereInput {
    switch (period) {
      case PublicPostPeriodValue.UPCOMING:
        return {
          eventStartAt: {
            not: null,
          },
          OR: [
            {
              eventEndAt: {
                gte: now,
              },
            },
            {
              eventEndAt: null,
              eventStartAt: {
                gte: now,
              },
            },
          ],
        };

      case PublicPostPeriodValue.PAST:
        return {
          eventStartAt: {
            not: null,
          },
          OR: [
            {
              eventEndAt: {
                lt: now,
              },
            },
            {
              eventEndAt: null,
              eventStartAt: {
                lt: now,
              },
            },
          ],
        };

      case PublicPostPeriodValue.UNDATED:
        return {
          eventStartAt: null,
        };

      case PublicPostPeriodValue.ALL:
      default:
        return {};
    }
  }
}
