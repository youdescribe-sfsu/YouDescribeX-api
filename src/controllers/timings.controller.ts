import { NextFunction, Request, Response } from 'express';
import { AddTotalTimeDto } from '../dtos/timings.dto';
import TimingsService from '../services/timings.service';

class TimingsController {
  public timingsService = new TimingsService();
  /**
   * @swagger
   * /timings:
   *   post:
   *     summary: Add total time to video
   *     tags: [Timings]
   *     description: Add total time to video by youtube ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/AddTotalTimeDto'
   *     responses:
   *       '201':
   *         description: Created
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Timings'
   *       '400':
   *         description: Bad request
   *       '500':
   *         description: Internal server error
   */
  public addTotalTime = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timingBody: AddTotalTimeDto = req.body;
      const videoByYoutubeID = await this.timingsService.addTotalTime(timingBody);
      res.status(201).json({ ...videoByYoutubeID });
    } catch (error) {
      next(error);
    }
  };
}

export default TimingsController;
