import { NextFunction, Request, Response } from 'express';
import { AudioDescGenerationRequestDTO, CreateUserAudioDescriptionDto, CreateUserDto, NewUserDto } from '../dtos/users.dto';
import { IUsers } from '../interfaces/users.interface';
import userService from '../services/users.service';
import AudioClipsService from '../services/audioClips.service';
import { logger } from '../utils/logger';
import { HOST } from '../config';
import { IUser } from '../models/mongodb/User.mongo';
import { MongoUsersModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import sendEmail from '../utils/emailService';

class UsersController {
  public userService = new userService();
  public audioClipsService = new AudioClipsService();
  /**
   * @swagger
   * /create-user-links/get-all-users:
   *   get:
   *     summary: Returns a list of all users
   *     tags: [Users]
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 data:
   *                   type: array
   *                   items:
   *                     $ref: '#/components/schemas/Users'
   *                   description: List of users
   *                 message:
   *                   type: string
   *                   description: Success message
   */
  public getUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const findAllUsersData = await this.userService.findAllUser();

      res.status(200).json({ data: findAllUsersData, message: 'findAll' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @swagger
   * /create-user-links/{email}:
   *   get:
   *     summary: Get user by email
   *     tags: [Users]
   *     description: Retrieve a user by their email address.
   *     parameters:
   *       - in: path
   *         name: email
   *         schema:
   *           type: string
   *         required: true
   *         description: The email address of the user to retrieve.
   *     responses:
   *       '200':
   *         description: A user object
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Users'
   *       '404':
   *         description: User not found
   *       '500':
   *         description: Internal server error
   */

  public getUserByEmail = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userEmail: string = req.query.email as string;
      const findOneUserData = await this.userService.findUserByEmail(userEmail);

      res.status(200).json({ data: findOneUserData, message: 'findOne' });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @swagger
   * /create-user-links/add-new-user:
   *   post:
   *     summary: Create a new user.
   *     tags: [Users]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUserDto'
   *     responses:
   *       201:
   *         description: The created user.
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Users'
   *       400:
   *         description: Invalid user data.
   */
  public createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData: CreateUserDto = req.body;
      const createUserData: any = await this.userService.createUser(userData);

      res.status(201).json({
        data: createUserData,
        message: 'created',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * @swagger
   * /create-user-links/create-new-user-ad:
   *   post:
   *     summary: Creates a new user audio description and returns a URL to generate audio files for the description
   *     tags: [Users]
   *     requestBody:
   *       description: User audio description object
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUserAudioDescriptionDto'
   *     responses:
   *       201:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   description: Success message
   *                 url:
   *                   type: string
   *                   description: URL to generate audio files for the new audio description
   */

  public createNewUserAudioDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newUserAudioDescription: CreateUserAudioDescriptionDto = req.body;
      const { audioDescriptionId, fromAI } = await this.userService.createNewUserAudioDescription(newUserAudioDescription, req.user);
      if (fromAI) {
        await this.audioClipsService.processAllClipsInDB(audioDescriptionId.toString());
      }

      res.status(201).json({
        message: `Successfully created new user Audio Description`,
        url: `${newUserAudioDescription.youtubeVideoId}/${audioDescriptionId}`,
      });
    } catch (error) {
      next(error);
    }
  };

  public createNewUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newUserData: NewUserDto = req.body;
      const returnData = await this.userService.createNewUser(newUserData);

      res.status(201).json(returnData);
    } catch (error) {
      next(error);
    }
  };

  public requestAiDescriptionsWithGpu = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const youtube_id = req.body.youtube_id;
      const hostname = req.headers.origin;
      const returnData = await this.userService.requestAiDescriptionsWithGpu(userData, youtube_id, hostname);
      res.status(201).json(returnData);
    } catch (error) {
      next(error);
    }
  };

  public generateAudioDescGpu = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newUserAudioDescription: AudioDescGenerationRequestDTO = req.body;
      const user = await MongoUsersModel.findById(newUserAudioDescription.userId);
      const videoInfo = await MongoVideosModel.findOne({ youtube_id: newUserAudioDescription.youtubeVideoId });
      if (!user) {
        throw new Error('User not found');
      }
      const audioDescriptionId = await this.userService.generateAudioDescGpu(newUserAudioDescription, user._id);

      logger.info(`Sending email to ${user.email}`);

      const YDX_APP_URL = `${newUserAudioDescription.ydx_app_host}/editor/${newUserAudioDescription.youtubeVideoId}/${audioDescriptionId}`;

      logger.info(`URL :: ${YDX_APP_URL}`);

      const email = await sendEmail(
        user.email,
        `Requested Audio Description for ${videoInfo.title} ready`,
        `Your Audio Description is now available! You're invited to view it by following this link: ${YDX_APP_URL}`,
      );

      console.log(email);
      logger.info(`Email sent to ${user.email}`);

      res.status(201).json({
        message: `Successfully created new user Audio Description`,
        url: `${YDX_APP_URL}`,
      });
    } catch (error) {
      next(error);
    }
  };
  public aiDescriptionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      console.log(userData);
      const youtube_id = req.body.youtube_id;
      // const videoInfo = await MongoVideosModel.findOne({ youtube_id: newUserAudioDescription.youtubeVideoId });

      // if(!videoInfo) {
      //   throw new Error('Video not found');
      // }

      if (!userData) {
        throw new Error('User not found');
      }
      const response = await this.userService.aiDescriptionStatus(userData._id, youtube_id);

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };
}

export default UsersController;
