import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger(AllExceptionsFilter.name);

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = 'An internal error occurred';
        let errorCode = 'INTERNAL_ERROR';
        let details: unknown = undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === 'string') {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === 'object') {
                const resp = exceptionResponse as Record<string, unknown>;
                message = (resp.message as string) || exception.message;
                details = resp.details || resp.message;
                errorCode = (resp.error as string) || 'HTTP_ERROR';
            }
        } else if (exception instanceof Error) {
            message = exception.message;
            this.logger.error(
                `Unhandled exception: ${exception.message}`,
                exception.stack,
            );
        }

        // Don't leak internal details in production
        if (
            process.env.APP_ENV === 'production' &&
            status === HttpStatus.INTERNAL_SERVER_ERROR
        ) {
            message = 'An internal error occurred';
            details = undefined;
        }

        response.status(status).json({
            success: false,
            error: {
                code: errorCode,
                message,
                ...(details ? { details } : {}),
            },
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
}
