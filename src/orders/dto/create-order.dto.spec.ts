import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateOrderDto } from './create-order.dto';

describe('CreateOrderDto', () => {
  const validProductId = '4d2f8c1a-1234-4c11-9f10-abc123456789';

  async function validateDto(payload: Record<string, unknown>) {
    const dto = plainToInstance(CreateOrderDto, payload);

    return validate(dto);
  }

  it('should accept a valid product ID and quantity', async () => {
    const errors = await validateDto({
      productId: validProductId,
      quantity: 2,
    });

    expect(errors).toHaveLength(0);
  });

  it('should reject an invalid product ID', async () => {
    const errors = await validateDto({
      productId: 'invalid-product-id',
      quantity: 1,
    });

    expect(errors.some((error) => error.property === 'productId')).toBe(true);
  });

  it('should reject quantity less than 1', async () => {
    const errors = await validateDto({
      productId: validProductId,
      quantity: 0,
    });

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });

  it('should reject a non-integer quantity', async () => {
    const errors = await validateDto({
      productId: validProductId,
      quantity: 1.5,
    });

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });

  it('should reject a string quantity', async () => {
    const errors = await validateDto({
      productId: validProductId,
      quantity: '2',
    });

    expect(errors.some((error) => error.property === 'quantity')).toBe(true);
  });
});
