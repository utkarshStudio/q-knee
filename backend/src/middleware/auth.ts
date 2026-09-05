import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; role: string };
  guestSessionId?: string;
  isGuest?: boolean;
}

export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1] || (req.query.token as string);
  if (token) {
    try {
      const secret = process.env.JWT_SECRET || 'hqml-default-jwt-secret-key-minimum-32-chars-long';
      const payload = jwt.verify(token, secret) as any;
      req.user = payload;
      req.isGuest = false;
      return next();
    } catch {
      // If token is invalid or expired, continue as guest session rather than throwing 401
    }
  }

  // Extract or sanitize guest session ID
  const guestHeader = (req.headers['x-guest-session-id'] as string) || (req.query.guest_session_id as string);
  const sanitizedGuestId = guestHeader && typeof guestHeader === 'string' && /^[a-zA-Z0-9_\-\.]{1,64}$/.test(guestHeader)
    ? guestHeader
    : uuidv4();

  req.guestSessionId = sanitizedGuestId;
  req.isGuest = true;
  next();
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.split(' ')[1] || (req.query.token as string);
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  try {
    const secret = process.env.JWT_SECRET || 'hqml-default-jwt-secret-key-minimum-32-chars-long';
    const payload = jwt.verify(token, secret) as any;
    req.user = payload;
    req.isGuest = false;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

