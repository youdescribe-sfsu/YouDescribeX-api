import { NextFunction, Request, Response } from 'express';
import { AddNewParticipantDto } from '../dtos/participant.dto';
import ParticipantService from '../services/participant.service';

class ParticipantController {
  public participantService = new ParticipantService();

  public addNewParticipant = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const timingBody: AddNewParticipantDto = req.body;
      const participantResponse = await this.participantService.addNewParticipant(timingBody);
      res.status(201).json({ ...participantResponse });
    } catch (error) {
      next(error);
    }
  };

  public getParticipantById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const participantId: string = req.params.participantId;
      const participantResponse = await this.participantService.getParticipantById(participantId);
      res.status(201).json({ ...participantResponse });
    } catch (error) {
      next(error);
    }
  };
}

export default ParticipantController;
