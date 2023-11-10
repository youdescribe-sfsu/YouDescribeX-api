import { Router } from 'express';
import { Routes } from '../interfaces/routes.interface';
import GpuUtilsController from '../controllers/gpu_utils.controller';

class GpuUtilsRoute implements Routes {
  public path = '/utils';
  public router = Router();
  public gpuUtilsController = new GpuUtilsController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/notify`, this.gpuUtilsController.notify);
    this.router.post(`${this.path}/notify/aidescriptions`, this.gpuUtilsController.notifyAiDescriptions);
  }
}

export default GpuUtilsRoute;
