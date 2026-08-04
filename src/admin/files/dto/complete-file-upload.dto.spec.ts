import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CompleteFileUploadDto } from './complete-file-upload.dto';

describe('CompleteFileUploadDto', () => {
  it('should accept a valid UUID v4 file ID', async () => {
    const dto = plainToInstance(CompleteFileUploadDto, {
      fileId: '9f3a2b1c-3333-4d22-8e20-def987654321',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid file ID', async () => {
    const dto = plainToInstance(CompleteFileUploadDto, {
      fileId: 'invalid-file-id',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a missing file ID', async () => {
    const dto = plainToInstance(CompleteFileUploadDto, {});

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
