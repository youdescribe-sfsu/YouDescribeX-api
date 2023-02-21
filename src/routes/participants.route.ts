import { Router } from 'express';
import ParticipantController from '../controllers/participant.controller';
import { Routes } from '../interfaces/routes.interface';

class TimingsRoute implements Routes {
  public path = '/create-participant-links';
  public router = Router();
  public participantController = new ParticipantController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/add-new-participant`, this.participantController.addNewParticipant);
    this.router.get(`${this.path}/get-participant/:participantId`, this.participantController.getParticipantById);
  }
}

export default TimingsRoute;
