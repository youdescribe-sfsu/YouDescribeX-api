import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../exceptions/HttpException';
import { logger } from '../utils/logger';

const errorMiddleware = (error: HttpException, req: Request, res: Response, next: NextFunction) => {
  try {
    let status: number = error.status || 500;
    // Map semantic error types (from utils/customErrors) to HTTP status codes.
    // Without this, a thrown AuthenticationError has no `.status` and falls
    // through to 500 instead of the correct 401/403.
    if (error.name === 'AuthenticationError') status = 401;
    if (error.name === 'AuthorizationError') status = 403;
    const message: string = error.message || 'Something went wrong';
    const stack = new Error().stack;
    const details = stack?.split('\n')[2]?.trim().split(' (')[1]?.slice(0, -1);

    // Log file and line details
    // console.log(`Middleware executed at: ${details}`);
    logger.error(`Middleware executed at: ${details}`);
    // console.log(JSON.stringify(error));
    logger.error(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}`);
    res.status(status).json({ message });
  } catch (error) {
    next(error);
  }
};

export default errorMiddleware;
