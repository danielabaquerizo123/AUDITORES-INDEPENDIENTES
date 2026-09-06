import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof exceptionResponse === 'object' && exceptionResponse && 'message' in exceptionResponse
      ? (exceptionResponse as { message: unknown }).message
      : status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Internal server error' : exceptionResponse;

    response.status(status).json({ statusCode: status, message, path: request.url, timestamp: new Date().toISOString() });
  }
}
