import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  UpdateProductDto,
  UpdateProductPublicationStatusValue,
} from './update-product.dto';

describe('UpdateProductDto', () => {
  it('should validate a partial product update', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      productName: '  KSA Premium Hoodie  ',
      tokenPrice: 180,
      stockQuantity: 15,
      isOrderable: false,
      description: '  Updated description.  ',
      publicationStatus: UpdateProductPublicationStatusValue.PUBLISHED,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.productName).toBe('KSA Premium Hoodie');
    expect(dto.description).toBe('Updated description.');
  });

  it('should allow null description and imageFileId', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      description: null,
      imageFileId: null,
      publicationStatus: UpdateProductPublicationStatusValue.DRAFT,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
  });

  it('should transform a whitespace-only description to null', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      description: '     ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it('should reject an empty product name when provided', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      productName: '   ',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('productName');
  });

  it('should reject a token price below one', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      tokenPrice: 0,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('tokenPrice');
  });

  it('should reject negative stock quantity', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      stockQuantity: -1,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('stockQuantity');
  });

  it('should allow all supported publication statuses', async () => {
    for (const publicationStatus of [
      UpdateProductPublicationStatusValue.DRAFT,
      UpdateProductPublicationStatusValue.PUBLISHED,
      UpdateProductPublicationStatusValue.HIDDEN,
    ]) {
      const dto = plainToInstance(UpdateProductDto, {
        publicationStatus,
      });

      const errors = await validate(dto);

      expect(errors).toHaveLength(0);
    }
  });

  it('should reject an unsupported publication status', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      publicationStatus: 'deleted',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(
      'publicationStatus',
    );
  });

  it('should reject descriptions longer than 1000 characters', async () => {
    const dto = plainToInstance(UpdateProductDto, {
      description: 'a'.repeat(1001),
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('description');
  });
});
