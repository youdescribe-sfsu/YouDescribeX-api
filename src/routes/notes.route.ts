import { Router } from 'express';
import NotesController from '../controllers/notes.controller';
import { Routes } from '../interfaces/routes.interface';

class NotesRoute implements Routes {
  public path = '/notes';
  public router = Router();
  public notesController = new NotesController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/post-note`, this.notesController.postNoteByAdId);
  }
}

export default NotesRoute;
