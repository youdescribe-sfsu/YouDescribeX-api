import { NextFunction, Request, Response } from 'express';
import { AuthenticationError } from '../utils/customErrors';

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  next();
};

export default authMiddleware;
