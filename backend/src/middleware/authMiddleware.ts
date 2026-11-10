/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { CONFIG } from '../config.ts';
import { db } from '../db/database.ts';
import type { User, UserRole } from '../types/index.ts';

export interface AuthenticatedRequest extends Request {
  user?: User;
  clientIp?: string;
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '10.1.60.8';
}

export function authenticateJwt(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  req.clientIp = extractClientIp(req);

  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication required. No token provided.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, CONFIG.JWT_SECRET) as {
      userId: number | string;
      role: UserRole;
    };

    const user = db.getUserById(Number(decoded.userId));
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User is inactive or no longer exists.' });
      return;
    }

    req.user = user;
    next();
  } catch (_err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRoles(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Forbidden. Role '${req.user.role}' lacks permissions for this administrative operation.`,
      });
      return;
    }

    next();
  };
}
