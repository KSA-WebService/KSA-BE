import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import { ResultTypeValue } from '../constants/response-api-values';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<{
    resultType: ResultTypeValue.SUCCESS;
    error: null;
    success: T;
  }> {
    return next.handle().pipe(
      map((data) => ({
        resultType: ResultTypeValue.SUCCESS,
        error: null,
        success: data,
      })),
    );
  }
}
