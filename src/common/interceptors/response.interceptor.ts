import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<{
    resultType: 'SUCCESS';
    error: null;
    success: T;
  }> {
    return next.handle().pipe(
      map((data) => ({
        resultType: 'SUCCESS',
        error: null,
        success: data,
      })),
    );
  }
}
