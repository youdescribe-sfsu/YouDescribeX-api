import { Router } from 'express';
import TimingsController from '../controllers/timings.controller';
import { Routes } from '../interfaces/routes.interface';

class TimingsRoute implements Routes {
  public path = '/add-timedata-to-db';
  public router = Router();
  public timingsController = new TimingsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/addtimedata`, this.timingsController.addTotalTime);
  }
}

export default TimingsRoute;
