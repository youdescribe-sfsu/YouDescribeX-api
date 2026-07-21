// xiao: unified session guard — passes when passport has populated req.user from the session cookie.
// Throws AuthenticationError which error.middleware.ts maps to HTTP 401.
// This gives the frontend 401 interceptor the signal it needs to detect expired sessions.
import { NextFunction, Request, Response } from 'express';
import { AuthenticationError } from '../utils/customErrors';

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    throw new AuthenticationError('Authentication required');
  }
  next();
};

export default authMiddleware;
