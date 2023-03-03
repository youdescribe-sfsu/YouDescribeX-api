import { NextFunction, Request, Response } from 'express';
import { CreateUserAudioDescriptionDto, CreateUserDto } from '../dtos/users.dto';
import { IUsers } from '../interfaces/users.interface';
import userService from '../services/users.service';

class UsersController {
  public userService = new userService();

  public getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const findAllUsersData: IUsers[] = await this.userService.findAllUser();

      res.status(200).json({ data: findAllUsersData, message: 'findAll' });
    } catch (error) {
      next(error);
    }
  };

  public getUserByEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId: string = req.params.email;
      const findOneUserData = await this.userService.findUserByEmail(userId);

      res.status(200).json({ data: findOneUserData, message: 'findOne' });
    } catch (error) {
      next(error);
    }
  };

  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const createUserData = await this.userService.createUser(userData);

      res.status(201).json({
        data: createUserData,
        message: 'created',
        url: `https://ydx.youdescribe.org/api/audio-clips/processAllClipsInDB/${createUserData._id}`,
      });
    } catch (error) {
      next(error);
    }
  };

  public createNewUserAudioDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newUserAudioDescription: CreateUserAudioDescriptionDto = req.body;
      const audioDescriptionID = await this.userService.createNewUserAudioDescription(newUserAudioDescription);

      res.status(201).json({
        message: `Success OK!! Use https://ydx.youdescribe.org/api/audio-clips/processAllClipsInDB/${audioDescriptionID} to generate audio files for the new Audio Description.`,
        url: `https://ydx.youdescribe.org/api/audio-clips/processAllClipsInDB/${audioDescriptionID}`,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default UsersController;
