import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { UnauthorizedError, ForbiddenError } from '../utils/app-error.js';
import { TokenPayload } from '../../types/global.js';
import { userRepository } from '../../modules/user/user.repository.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export async function authGuard(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.substring(7);
    const payload = verifyAccessToken(token);
    const parsedUserId = parseInt(payload.userId, 10);

    if (Number.isNaN(parsedUserId)) {
      throw new UnauthorizedError('Invalid token payload');
    }

    const user = await userRepository.findById(parsedUserId);
    if (!user) {
      throw new UnauthorizedError('Session is no longer valid. Please login again.');
    }

    payload.userId = parsedUserId.toString();

    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Invalid token'));
  }
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const payload = verifyAccessToken(token);
      const parsedUserId = parseInt(payload.userId, 10);
      if (!Number.isNaN(parsedUserId)) {
        payload.userId = parsedUserId.toString();
        req.user = payload;
      }
    }
  } catch {
    // Ignore invalid tokens for optional auth
  }

  next();
}

export async function requireAdmin(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsedUserId = parseInt(req.user.userId, 10);
    if (Number.isNaN(parsedUserId)) {
      throw new UnauthorizedError('Invalid token payload');
    }

    const user = await userRepository.findById(parsedUserId);

    if (!user || !user.is_admin) {
      throw new ForbiddenError('Admin access required');
    }

    next();
  } catch (error) {
    next(error);
  }
}
