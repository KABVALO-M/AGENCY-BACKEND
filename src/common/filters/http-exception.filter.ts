import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../logger/app-logger.service';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const request = httpContext.getRequest<Request>();

    const { statusCode, message } = this.prepareExceptionPayload(exception);

    this.logger.error(
      message,
      exception instanceof Error ? exception.stack : undefined,
      AllExceptionsFilter.name,
    );

    response.status(statusCode).json({
      statusCode,
      path: request.url,
      message,
      data: null,
    });
  }

  private prepareExceptionPayload(exception: unknown): {
    statusCode: number;
    message: string;
  } {
    if (exception instanceof HttpException) {
      const statusCode = exception.getStatus();
      const response = exception.getResponse();

      if (typeof response === 'string') {
        return {
          statusCode,
          message: response,
        };
      }

      if (typeof response === 'object' && response !== null) {
        const { message } = response as {
          message?: string | string[];
        };

        return {
          statusCode,
          message: this.normalizeMessage(message),
        };
      }

      return {
        statusCode,
        message: exception.message,
      };
    }

    if (exception instanceof Error) {
      return {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        message: exception.message || 'Internal server error',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    };
  }

  private normalizeMessage(input?: string | string[]): string {
    if (Array.isArray(input)) {
      return input.join('; ');
    }
    return input ?? 'An unexpected error occurred';
  }
}
