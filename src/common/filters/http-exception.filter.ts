import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ResultTypeValue } from '../constants/response-api-values';
import type { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    const errorBody =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : {};

    const reason =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : typeof errorBody.message === 'string'
          ? errorBody.message
          : Array.isArray(errorBody.message)
            ? errorBody.message.join(', ')
            : 'Internal server error';

    response.status(status).json({
      resultType: ResultTypeValue.FAIL,
      error: {
        errorCode: errorBody.errorCode ?? `HTTP_${status}`,
        reason,
        data: errorBody.data ?? null,
      },
      success: null,
    });
  }
}
