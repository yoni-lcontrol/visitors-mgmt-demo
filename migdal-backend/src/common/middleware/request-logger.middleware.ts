import { Logger } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const logger = new Logger('InboundRequest');

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl } = req;
    const start = Date.now();

    res.on('finish', () => {
        const duration = Date.now() - start;
        const message = `${method} ${originalUrl} -> ${res.statusCode} (${duration}ms)`;

        if (res.statusCode >= 500) {
            logger.error(message);
        } else if (res.statusCode >= 400) {
            logger.warn(message);
        } else {
            logger.log(message);
        }
    });

    next();
}
