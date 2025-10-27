import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const httpContext = context.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();

    return next.handle().pipe(
      map((data) => {
        return {
          statusCode: response.statusCode,
          path: request.url,
          message: this.extractMessage(data),
          data: this.extractData(data),
        };
      }),
    );
  }

  private extractMessage(data: unknown): string {
    if (typeof data === 'string' && data.length > 0) {
      return data;
    }

    if (data && typeof data === 'object' && 'message' in data) {
      const { message } = data as Record<string, unknown>;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
    return 'Request successful';
  }

  private extractData(data: unknown): unknown {
    if (typeof data === 'string') {
      return null;
    }

    if (data && typeof data === 'object' && 'message' in data) {
      const { message, ...rest } = data as Record<string, unknown>;
      if (Object.keys(rest).length === 0) {
        return null;
      }
      return rest;
    }
    return data ?? null;
  }
}
