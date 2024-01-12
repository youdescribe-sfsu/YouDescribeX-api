import { NextFunction, Request, Response } from 'express';
import { HttpException } from '../exceptions/HttpException';
import { logger } from '../utils/logger';

const errorMiddleware = (error: HttpException, req: Request, res: Response, next: NextFunction) => {
  try {
    const status: number = error.status || 500;
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
