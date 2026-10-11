/**
 * Global HTTP Exception Filter
 * Gère et formate tous les erreurs HTTP
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('HttpExceptionFilter');

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const response = ctx.getResponse();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : exception;

    const message =
      typeof exceptionResponse === 'object'
        ? (exceptionResponse as any).message
        : exceptionResponse;

    const errorResponse = {
      error: {
        code: this.getErrorCode(status),
        message: message || 'An error occurred',
        details: typeof exceptionResponse === 'object' ? exceptionResponse : undefined,
        timestamp: new Date().toISOString(),
        requestId: request.headers['x-request-id'] || this.generateRequestId(),
        path: request.url,
        method: request.method,
        statusCode: status,
      },
    };

    // Log l'erreur
    if (status >= 500) {
      this.logger.error(`${status} ${request.method} ${request.url}`, exception);
    } else if (status >= 400) {
      this.logger.warn(`${status} ${request.method} ${request.url} - ${message}`);
    }

    response.status(status).json(errorResponse);
  }

  private getErrorCode(status: number): string {
    const errorCodes: { [key: number]: string } = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
      502: 'BAD_GATEWAY',
      503: 'SERVICE_UNAVAILABLE',
      504: 'GATEWAY_TIMEOUT',
    };

    return errorCodes[status] || `ERROR_${status}`;
  }

  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }
}
