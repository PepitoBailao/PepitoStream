import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: 'user' | 'admin' | 'moderator';
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    throw new AppError(401, 'No token provided');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    req.user = decoded as any;
    next();
  } catch (err) {
    throw new AppError(401, 'Invalid token');
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new AppError(403, 'Insufficient permissions');
    }
    next();
  };
};

export const generateToken = (
  userId: string,
  email: string,
  role: string,
  expiresIn = '7d'
) => {
  return jwt.sign(
    { id: userId, email, role },
    process.env.JWT_SECRET || 'secret',
    { expiresIn }
  );
};
