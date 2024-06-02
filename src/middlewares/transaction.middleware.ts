import { Request, Response, NextFunction } from 'express';
import mongoose, { ClientSession } from 'mongoose';

type ControllerMethod = (req: Request, res: Response, next: NextFunction, session: ClientSession) => Promise<void>;

export function withTransaction(controllerMethod: ControllerMethod, timeout = 5000) {
  return async function (req: Request, res: Response, next: NextFunction): Promise<void> {
    const session = await mongoose.startSession();
    session.startTransaction();

    const timeoutHandle = setTimeout(async () => {
      await session.abortTransaction();
      session.endSession();
      next(new Error('Transaction timed out'));
    }, timeout);

    try {
      await controllerMethod(req, res, next, session);
      await session.commitTransaction();
      clearTimeout(timeoutHandle);
      session.endSession();
    } catch (error) {
      clearTimeout(timeoutHandle);
      await session.abortTransaction();
      session.endSession();
      next(error);
    }
  };
}
