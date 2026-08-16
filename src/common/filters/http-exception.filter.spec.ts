import { ArgumentsHost, BadRequestException, HttpStatus } from '@nestjs/common';
import { ResultTypeValue } from '../constants/response-api-values';
import { HttpExceptionFilter } from './http-exception.filter';

describe('HttpExceptionFilter', () => {
  const createHost = () => {
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

    return {
      host,
      status,
      json,
    };
  };

  it('should preserve a custom error code and error data', () => {
    const filter = new HttpExceptionFilter();

    const { host, status, json } = createHost();

    filter.catch(
      new BadRequestException({
        errorCode: 'TEST400_INVALID_REQUEST',
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
        errorCode: 'TEST400_INVALID_REQUEST',
        reason: 'Invalid request',
        data: {
          field: 'test',
        },
      },
      success: null,
    });
  });

  it('should use an HTTP status fallback when no custom error code exists', () => {
    const filter = new HttpExceptionFilter();

    const { host, status, json } = createHost();

    filter.catch(new BadRequestException('Invalid request'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

    expect(json).toHaveBeenCalledWith({
      resultType: ResultTypeValue.FAIL,
      error: {
        errorCode: 'HTTP_400',
        reason: 'Invalid request',
        data: null,
      },
      success: null,
    });
  });

  it('should join array validation messages into a single reason', () => {
    const filter = new HttpExceptionFilter();

    const { host, status, json } = createHost();

    filter.catch(
      new BadRequestException({
        message: ['name must not be empty', 'email must be an email'],
      }),
      host,
    );

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);

    expect(json).toHaveBeenCalledWith({
      resultType: ResultTypeValue.FAIL,
      error: {
        errorCode: 'HTTP_400',
        reason: 'name must not be empty, email must be an email',
        data: null,
      },
      success: null,
    });
  });

  it('should mask unexpected non-HTTP errors as internal server errors', () => {
    const filter = new HttpExceptionFilter();

    const { host, status, json } = createHost();

    filter.catch(new Error('Sensitive database failure'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);

    expect(json).toHaveBeenCalledWith({
      resultType: ResultTypeValue.FAIL,
      error: {
        errorCode: 'HTTP_500',
        reason: 'Internal server error',
        data: null,
      },
      success: null,
    });
  });
});
