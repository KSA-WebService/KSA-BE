import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateTokenEventDto } from './update-token-event.dto';

describe('UpdateTokenEventDto', () => {
  it('should trim and accept a valid event name', async () => {
    const dto = plainToInstance(UpdateTokenEventDto, {
      eventName: '  KSA Welcome Event  ',
    });

    const errors = await validate(dto);

    expect(errors).toHaveLength(0);
    expect(dto.eventName).toBe('KSA Welcome Event');
  });

  it('should reject an empty normalized event name', async () => {
    const dto = plainToInstance(UpdateTokenEventDto, {
      eventName: '   ',
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject an event name longer than 128 characters', async () => {
    const dto = plainToInstance(UpdateTokenEventDto, {
      eventName: 'a'.repeat(129),
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject a non-string event name', async () => {
    const dto = plainToInstance(UpdateTokenEventDto, {
      eventName: 123,
    });

    const errors = await validate(dto);

    expect(errors.length).toBeGreaterThan(0);
  });
});
