import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import {
  CreateProductDto,
  CreateProductPublicationStatusValue,
  CreateProductTypeValue,
} from './create-product.dto';

describe('CreateProductDto', () => {
  it('should validate a published product request', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: '  KSA Hoodie  ',
      productType: CreateProductTypeValue.MERCHANDISE,
      tokenPrice: 150,
      stockQuantity: 20,
      isOrderable: true,
      description: '  Official KSA hoodie for HKUST students.  ',
      imageFileId: '9f3a2b1c-3333-4d22-8e20-def987654321',
      publicationStatus: CreateProductPublicationStatusValue.PUBLISHED,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.productName).toBe('KSA Hoodie');
    expect(dto.description).toBe('Official KSA hoodie for HKUST students.');
  });

  it('should allow a draft product without description or image', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Lucky Draw Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.isOrderable).toBe(true);
    expect(dto.description).toBeUndefined();
    expect(dto.imageFileId).toBeUndefined();
  });

  it('should require publicationStatus', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Lucky Draw Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(
      'publicationStatus',
    );
  });

  it('should reject hidden as a creation status', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Lucky Draw Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      publicationStatus: 'hidden',
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain(
      'publicationStatus',
    );
  });

  it('should reject unsupported product types', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Test Product',
      productType: 'coupon',
      tokenPrice: 10,
      stockQuantity: 10,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('productType');
  });

  it('should reject a token price below one', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Free Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 0,
      stockQuantity: 10,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('tokenPrice');
  });

  it('should reject a negative stock quantity', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Test Product',
      productType: CreateProductTypeValue.MERCHANDISE,
      tokenPrice: 20,
      stockQuantity: -1,
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('stockQuantity');
  });

  it('should transform a whitespace-only description to null', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Draft Ticket',
      productType: CreateProductTypeValue.TICKET,
      tokenPrice: 10,
      stockQuantity: 100,
      description: '   ',
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.description).toBeNull();
  });

  it('should reject a description longer than 1000 characters', async () => {
    const dto = plainToInstance(CreateProductDto, {
      productName: 'Test Product',
      productType: CreateProductTypeValue.MERCHANDISE,
      tokenPrice: 20,
      stockQuantity: 10,
      description: 'a'.repeat(1001),
      publicationStatus: CreateProductPublicationStatusValue.DRAFT,
    });

    const errors = await validate(dto);

    expect(errors.map((error) => error.property)).toContain('description');
  });
});
