import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/app-error.js';
import { logger } from '../../config/logger.js';

export function errorFilter(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = res.locals.requestId;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      requestId,
      code: err.code,
      message: err.message,
      ...(process.env.NODE_ENV !== 'production' && err.details ? { details: err.details } : {}),
    });
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');

  res.status(500).json({
    requestId,
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  });
}
