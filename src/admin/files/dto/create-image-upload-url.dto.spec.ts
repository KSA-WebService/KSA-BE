import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FilePurposeValue } from '../../../common/constants/file-api-values';
import { CreateImageUploadUrlDto } from './create-image-upload-url.dto';

describe('CreateImageUploadUrlDto', () => {
  it('should trim and accept valid image metadata', async () => {
    const dto = plainToInstance(CreateImageUploadUrlDto, {
      originalName: '  notice-image.png  ',
      contentType: 'image/png',
      fileSize: 204800,
      purpose: FilePurposeValue.POST_IMAGE,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.originalName).toBe('notice-image.png');
  });

  it('should reject a missing file name', async () => {
    const dto = plainToInstance(CreateImageUploadUrlDto, {
      contentType: 'image/png',
      fileSize: 204800,
      purpose: FilePurposeValue.POST_IMAGE,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a non-integer file size', async () => {
    const dto = plainToInstance(CreateImageUploadUrlDto, {
      originalName: 'notice-image.png',
      contentType: 'image/png',
      fileSize: 10.5,
      purpose: FilePurposeValue.POST_IMAGE,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an unsupported purpose', async () => {
    const dto = plainToInstance(CreateImageUploadUrlDto, {
      originalName: 'notice-image.png',
      contentType: 'image/png',
      fileSize: 204800,
      purpose: 'UNKNOWN',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject uppercase Prisma purpose values', async () => {
    const dto = plainToInstance(CreateImageUploadUrlDto, {
      originalName: 'notice-image.png',
      contentType: 'image/png',
      fileSize: 204800,
      purpose: 'POST_IMAGE',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('purpose');
  });
});
