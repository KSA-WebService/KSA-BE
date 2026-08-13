import { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { ResultTypeValue } from '../constants/response-api-values';
import { ResponseInterceptor } from './response.interceptor';

describe('ResponseInterceptor', () => {
  it('should wrap a successful response with lowercase resultType', async () => {
    const interceptor = new ResponseInterceptor();

    const next: CallHandler = {
      handle: () =>
        of({
          userId: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
        }),
    };

    const result = await lastValueFrom(
      interceptor.intercept({} as ExecutionContext, next),
    );

    expect(result).toEqual({
      resultType: ResultTypeValue.SUCCESS,
      error: null,
      success: {
        userId: 'b5b922c5-9ca5-4c29-81e6-8faec8fbda53',
      },
    });
  });
});
