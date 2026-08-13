import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { ResultTypeValue } from '../constants/response-api-values';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('should wrap an HTTP exception with lowercase resultType', () => {
    const filter = new HttpExceptionFilter();

    const json = jest.fn();
    const status = jest.fn().mockReturnValue({
      json,
    });

    const host = {
      switchToHttp: () => ({
        getResponse: () => ({
          status,
        }),
      }),
    } as unknown as ArgumentsHost;

    filter.catch(
      new BadRequestException({
        errorCode: 'TEST400',
        message: 'Invalid request',
        data: {
          field: 'test',
        },
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

    expect(json).toHaveBeenCalledWith({
      resultType: ResultTypeValue.FAIL,
      error: {
        errorCode: 'TEST400',
        reason: 'Invalid request',
        data: {
          field: 'test',
        },
      },
      success: null,
    });
  });
});
