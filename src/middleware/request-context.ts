import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export interface RequestContextRequest extends Request {
  requestId?: string;
}

export function requestContextMiddleware(
  req: RequestContextRequest,
  res: Response,
  next: NextFunction
): void {
  const headerValue = req.headers['x-request-id'];
  const requestId =
    typeof headerValue === 'string' && headerValue.trim().length > 0
      ? headerValue.trim()
      : randomUUID();

  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export default requestContextMiddleware;
