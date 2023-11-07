import { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';
import GpuUtilsService from '../services/gpu_utils.service';

class GpuUtilsController {
  public gpuUtilsService = new GpuUtilsService();

  // Notify User with Email
  public notify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, subject, text } = req.body;
      if (!email) {
        logger.error(`Error Sending Email Due to Error :: ${JSON.stringify('Email is required')} `);
        throw new Error('Email is required');
      }
      if (!subject) {
        logger.error(`Error Sending Email Due to Error :: ${JSON.stringify('Subject is required')} `);
        throw new Error('Subject is required');
      }
      if (!text) {
        logger.error(`Error Sending Email Due to Error :: ${JSON.stringify('Email Body is required')} `);
        throw new Error('Email Body is required');
      }

      const data = await this.gpuUtilsService.notify(email, subject, text);
      res.status(200).json({ data, message: 'notify' });
    } catch (error) {
      next(error);
    }
  };
}

export default GpuUtilsController;
