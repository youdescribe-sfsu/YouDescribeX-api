import { Router } from 'express';
import DialogTimestampsController from '../controllers/dialogTimestamps.controller';
import { Routes } from '../interfaces/routes.interface';

class DialogTimestampsRoute implements Routes {
    public path = '/dialogTimestamps';
    public router = Router();
    public dialogTimestampsController = new DialogTimestampsController();
  
    constructor() {
      this.initializeRoutes();
    }
  
    private initializeRoutes() {
      this.router.get(`${this.path}/get-video-dialog/:videoId`, this.dialogTimestampsController.getVideoDialogTimestamps);
    }
  }
  
  export default DialogTimestampsRoute;