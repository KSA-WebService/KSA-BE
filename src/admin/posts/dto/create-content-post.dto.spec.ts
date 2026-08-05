import { BadRequestException, ValidationPipe } from '@nestjs/common';

import {
  ContentPostCategoryValue,
  CreateContentPostDto,
  CreateContentPostStatus,
} from './create-content-post.dto';

describe('CreateContentPostDto', () => {
  const validationPipe = new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  });

  const fileId1 = '421c9cce-db39-471f-a49a-5da4d28f74c0';

  const fileId2 = '9f3a2b1c-3333-4d22-8e20-def987654321';

  const fileId3 = '1f3a2b1c-4444-4d22-8e20-def987654321';

  const fileId4 = '2f3a2b1c-5555-4d22-8e20-def987654321';

  async function transformDto(
    body: Record<string, unknown>,
  ): Promise<CreateContentPostDto> {
    const result: unknown = await validationPipe.transform(body, {
      type: 'body',
      metatype: CreateContentPostDto,
      data: '',
    });

    return result as CreateContentPostDto;
  }

  it('should accept a valid published post with four images', async () => {
    const result = await transformDto({
      title: 'Members-only Career Talk',
      content: '📌 Career talk details\n• Venue: HKUST',
      categories: [
        ContentPostCategoryValue.CAREER,
        ContentPostCategoryValue.EVENT,
        ContentPostCategoryValue.ALUMNI,
      ],
      membersOnly: true,
      status: CreateContentPostStatus.PUBLISHED,
      eventStartAt: '2026-09-10T18:30:00+08:00',
      eventEndAt: '2026-09-10T20:00:00+08:00',
      showOnCalendar: true,
      imageFileIds: [fileId1, fileId2, fileId3, fileId4],
    });

    expect(result).toMatchObject({
      title: 'Members-only Career Talk',
      content: '📌 Career talk details\n• Venue: HKUST',
      categories: [
        ContentPostCategoryValue.CAREER,
        ContentPostCategoryValue.EVENT,
        ContentPostCategoryValue.ALUMNI,
      ],
      membersOnly: true,
      status: CreateContentPostStatus.PUBLISHED,
      showOnCalendar: true,
      imageFileIds: [fileId1, fileId2, fileId3, fileId4],
    });
  });

  it('should trim leading and trailing whitespace from the title', async () => {
    const result = await transformDto({
      title: '  Orientation Day  ',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
    });

    expect(result.title).toBe('Orientation Day');
  });

  it('should accept a draft post without optional fields', async () => {
    const result = await transformDto({
      title: 'Orientation Day',
      categories: [ContentPostCategoryValue.EVENT],
      status: CreateContentPostStatus.DRAFT,
    });

    expect(result).toEqual(
      expect.objectContaining({
        title: 'Orientation Day',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
      }),
    );

    expect(result.content).toBeUndefined();
    expect(result.imageFileIds).toBeUndefined();
  });

  it('should accept null event date-time values', async () => {
    const result = await transformDto({
      title: 'General Announcement',
      categories: [ContentPostCategoryValue.ANNOUNCEMENT],
      status: CreateContentPostStatus.DRAFT,
      eventStartAt: null,
      eventEndAt: null,
    });

    expect(result.eventStartAt).toBeNull();
    expect(result.eventEndAt).toBeNull();
  });

  it('should accept a start time without an end time', async () => {
    const result = await transformDto({
      title: 'Career Talk',
      categories: [ContentPostCategoryValue.CAREER],
      status: CreateContentPostStatus.DRAFT,
      eventStartAt: '2026-09-10T18:30:00+08:00',
      eventEndAt: null,
    });

    expect(result.eventStartAt).toBe('2026-09-10T18:30:00+08:00');

    expect(result.eventEndAt).toBeNull();
  });

  it('should reject a blank title after trimming', async () => {
    await expect(
      transformDto({
        title: '   ',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject hidden status during creation', async () => {
    await expect(
      transformDto({
        title: 'Hidden Post',
        categories: [ContentPostCategoryValue.EVENT],
        status: 'hidden',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject an empty category array', async () => {
    await expect(
      transformDto({
        title: 'Post Without Category',
        categories: [],
        status: CreateContentPostStatus.DRAFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject duplicate categories', async () => {
    await expect(
      transformDto({
        title: 'Duplicate Categories',
        categories: [
          ContentPostCategoryValue.EVENT,
          ContentPostCategoryValue.EVENT,
        ],
        status: CreateContentPostStatus.DRAFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject an unsupported category', async () => {
    await expect(
      transformDto({
        title: 'Unsupported Category',
        categories: ['ksa'],
        status: CreateContentPostStatus.DRAFT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject more than four images', async () => {
    await expect(
      transformDto({
        title: 'Too Many Images',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
        imageFileIds: [
          fileId1,
          fileId2,
          fileId3,
          fileId4,
          '3f3a2b1c-6666-4d22-8e20-def987654321',
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject duplicate image file IDs', async () => {
    await expect(
      transformDto({
        title: 'Duplicate Images',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
        imageFileIds: [fileId1, fileId1],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject an invalid image file UUID', async () => {
    await expect(
      transformDto({
        title: 'Invalid Image ID',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
        imageFileIds: ['not-a-valid-uuid'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject a date without a time and UTC offset', async () => {
    await expect(
      transformDto({
        title: 'Invalid Event Date',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
        eventStartAt: '2026-09-10',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject a date-time without a UTC offset', async () => {
    await expect(
      transformDto({
        title: 'Missing Timezone',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
        eventStartAt: '2026-09-10T18:30:00',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('should reject unknown request fields', async () => {
    await expect(
      transformDto({
        title: 'Unknown Field Post',
        categories: [ContentPostCategoryValue.EVENT],
        status: CreateContentPostStatus.DRAFT,
        publishedAt: '2026-08-06T00:00:00.000Z',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
