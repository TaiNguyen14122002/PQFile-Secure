import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/**
 * Keep programmer/database/storage error details in the API logs, not in responses.
 * The error ID allows a browser report to be matched to the exact server failure.
 */
@Catch()
export class ApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    if (res.headersSent) return;

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const id = status >= 500 ? randomUUID() : undefined;
    if (id) {
      const detail = exception instanceof Error ? exception.stack || exception.message : String(exception);
      // Log the method and matched route only; never log query strings or request bodies.
      const route = (req as Request & {route?: {path?: string}}).route?.path || '(unmatched route)';
      console.error(`[PQFile API] ${id} ${req.method} ${route} HTTP ${status}\n${detail}`);
    }
    const response = exception instanceof HttpException ? exception.getResponse() : null;
    const candidate = typeof response === 'string' ? response
      : response && typeof response === 'object' && 'message' in response ? response.message : undefined;
    const publicMessage = Array.isArray(candidate) ? candidate.filter(x => typeof x === 'string').join('; ')
      : typeof candidate === 'string' ? candidate : undefined;
    // Preserve deliberate 503 messages, but do not leak PostgreSQL/S3/internal stack traces.
    const safeMessage = status >= 500
      ? status === HttpStatus.SERVICE_UNAVAILABLE && publicMessage
        ? publicMessage : 'Máy chủ gặp sự cố. Vui lòng thử lại hoặc cung cấp mã lỗi cho người quản trị.'
      : publicMessage || (exception instanceof HttpException ? exception.message : 'Yêu cầu không hợp lệ');
    res.status(status).json({ statusCode: status, message: safeMessage, ...(id ? { errorId: id } : {}) });
  }
}
