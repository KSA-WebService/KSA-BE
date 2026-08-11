import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { UpdateOrderStatusDto } from './update-order-status.dto';

describe('UpdateOrderStatusDto', () => {
  async function validateDto(payload: Record<string, unknown>) {
    const dto = plainToInstance(UpdateOrderStatusDto, payload);
    const errors = await validate(dto);

    return {
      dto,
      errors,
    };
  }

  it('should accept the accepted status', async () => {
    const { errors } = await validateDto({
      orderStatus: 'accepted',
    });

    expect(errors).toHaveLength(0);
  });

  it('should accept the delivered status', async () => {
    const { errors } = await validateDto({
      orderStatus: 'delivered',
    });

    expect(errors).toHaveLength(0);
  });

  it('should accept the canceled status with a cancellation reason', async () => {
    const { errors } = await validateDto({
      orderStatus: 'canceled',
      cancellationReason: 'Item is no longer available',
    });

    expect(errors).toHaveLength(0);
  });

  it('should reject ordered as a target status', async () => {
    const { errors } = await validateDto({
      orderStatus: 'ordered',
    });

    expect(errors.some((error) => error.property === 'orderStatus')).toBe(true);
  });

  it('should reject an unsupported status', async () => {
    const { errors } = await validateDto({
      orderStatus: 'refunded',
    });

    expect(errors.some((error) => error.property === 'orderStatus')).toBe(true);
  });

  it('should reject a cancellation reason longer than 255 characters', async () => {
    const { errors } = await validateDto({
      orderStatus: 'canceled',
      cancellationReason: 'a'.repeat(256),
    });

    expect(
      errors.some((error) => error.property === 'cancellationReason'),
    ).toBe(true);
  });

  it('should reject a non-string cancellation reason', async () => {
    const { errors } = await validateDto({
      orderStatus: 'canceled',
      cancellationReason: 123,
    });

    expect(
      errors.some((error) => error.property === 'cancellationReason'),
    ).toBe(true);
  });

  it('should allow a missing cancellation reason at DTO validation level', async () => {
    const { errors } = await validateDto({
      orderStatus: 'canceled',
    });

    expect(errors).toHaveLength(0);
  });
});
