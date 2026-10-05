import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiError');
  catch(error: any, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();
    const requestId = randomUUID();
    const status = error instanceof HttpException ? error.getStatus() : 500;
    if (status >= 500)
      this.logger.error(
        JSON.stringify({
          requestId,
          method: request.method,
          path: request.path,
          errorType: error?.name || 'Error',
          code: error?.code,
          column: error?.meta?.column,
        }),
      );
    const details =
      error instanceof HttpException
        ? error.getResponse()
        : { message: 'Internal server error' };
    response.setHeader('X-Request-Id', requestId);
    response
      .status(status)
      .json({
        ...(typeof details === 'string' ? { message: details } : details),
        statusCode: status,
        requestId,
      });
  }
}
