import { NextFunction, Request, Response } from 'express';
import { AudioDescGenerationRequestDTO, CreateUserAudioDescriptionDto, CreateUserDto, NewUserDto } from '../dtos/users.dto';
import { IUsers } from '../interfaces/users.interface';
import userService from '../services/users.service';
import AudioClipsService from '../services/audioClips.service';
import { logger } from '../utils/logger';
import { AI_USER_ID, HOST } from '../config';
import { IUser } from '../models/mongodb/User.mongo';
import { MongoUsersModel, MongoVideosModel } from '../models/mongodb/init-models.mongo';
import sendEmail from '../utils/emailService';
import { getYouTubeVideoStatus } from '../utils/util';
import { deepCopyAudioClip } from '../utils/audioClips.util';
import { deepCopyAudioDescriptionWithoutNewClips, updateAutoClips, updateContributions } from '../utils/audiodescriptions.util';
import { PipelineFailureDto } from '../dtos/pipelineFailure.dto';
import { InfoBotRequestDto } from '../dtos/infoBotRequest.dto';

class UsersController {
  public userService = new userService();
  public audioClipsService = new AudioClipsService();
  /**
   * @swagger
   * /users/get-all-users:
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
   * /users/{email}:
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
   * /users/add-new-user:
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
   * /users/create-new-user-ad:
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

  public createCollaborativeDescription = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = req.user as unknown as IUser;
      if (!user) throw new Error('User not found');
      const videoId: string = req.body.youtubeVideoId;
      const audio_description_id = req.body.oldDescriberId;
      // deep copy audio description
      const deepCopiedAudioDescriptionId = await deepCopyAudioDescriptionWithoutNewClips(audio_description_id, user._id);
      const deepCopiedClipIds = await deepCopyAudioClip(audio_description_id, deepCopiedAudioDescriptionId, user._id, videoId);
      await updateAutoClips(deepCopiedAudioDescriptionId, deepCopiedClipIds);
      // replace audio description clip id with deep copied clip id
      res.status(201).json({
        message: `Successfully deeply copied Audio Description`,
        url: `${videoId}/${deepCopiedAudioDescriptionId}`,
      });
    } catch (error) {
      next(error);
    }
  };

  public calculateContributions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const audioDescriptionId: string = req.body.audioDescriptionId;
      const user = req.user as unknown as IUser;
      const userId = user._id.toString();
      await updateContributions(audioDescriptionId, userId);
      res.status(201).json({
        message: 'Contributions calculated',
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

  public getAiServiceStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const status = await this.userService.checkAIServiceAvailability();
      res.status(200).json(status);
    } catch (error) {
      next(error);
    }
  };

  public increaseRequestCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      console.log(userData);
      const youtube_id = req.body.youtube_id;
      const returnData = await this.userService.increaseRequestCount(youtube_id, userData._id, AI_USER_ID);
      res.status(201).json(returnData);
    } catch (error) {
      next(error);
    }
  };

  public generateAudioDescGpu = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const newUserAudioDescription: AudioDescGenerationRequestDTO = req.body;
      const user = await MongoUsersModel.findById(newUserAudioDescription.userId);
      const videoInfo = await getYouTubeVideoStatus(newUserAudioDescription.youtubeVideoId);
      if (!user) {
        throw new Error('User not found');
      }
      const audioDescriptionId = await this.userService.generateAudioDescGpu(newUserAudioDescription, user._id);
      await this.audioClipsService.processAllClipsInDB(audioDescriptionId.audioDescriptionId.toString());

      logger.info(`Sending email to ${user.email}`);

      if (newUserAudioDescription?.ydx_app_host) {
        const YDX_APP_URL = `${newUserAudioDescription.ydx_app_host}/editor/${newUserAudioDescription.youtubeVideoId}/${audioDescriptionId.audioDescriptionId}`;
        // Remove all whitespace from the URL
        const replaced_url = YDX_APP_URL.replace(/\s/g, '');

        logger.info(`URL :: ${YDX_APP_URL}`);

        await sendEmail(
          user.email,
          `Requested Audio Description for ${videoInfo.title} ready`,
          `Your Audio Description is now available! You're invited to view it by following this link: ${YDX_APP_URL}`,
        );

        logger.info(`Email sent to ${user.email}`);

        res.status(201).json({
          message: `Successfully created new user Audio Description`,
          url: `${replaced_url}`,
        });
      } else {
        // Return the URL to the user
        res.status(201).json({
          message: `Successfully created new user Audio Description`,
          url: `${newUserAudioDescription.youtubeVideoId}/${audioDescriptionId}`,
        });
      }
    } catch (error) {
      logger.error(error);
      // console.log(error);
      next(error);
    }
  };

  public aiDescriptionStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const youtube_id = req.body.youtube_id;

      if (!userData) {
        throw new Error('User not found');
      }
      const response = await this.userService.aiDescriptionStatus(userData._id, youtube_id);

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public getUserAiDescriptionRequests = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const pageNumber = req.query.page;
      const paginate = req.query.paginate !== 'false';
      if (!userData) {
        throw new Error('User not logged in');
      }
      const user = await MongoUsersModel.findById(userData._id);
      if (!user) {
        throw new Error('User not found');
      }
      const response = await this.userService.getUserAiDescriptionRequests(user._id, <string>pageNumber, paginate);

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public generateAiDescriptions = async (req: Request, res: Response, next: NextFunction) => {
    const userData = req.user as unknown as IUser;
    const newUserAudioDescription: {
      youtube_id: string;
    } = req.body;
    try {
      const user = await MongoUsersModel.findById(userData._id);
      if (!user) {
        throw new Error('User not found');
      }
      const audioDescriptionId = await this.userService.generateAudioDescGpu(
        {
          youtubeVideoId: newUserAudioDescription.youtube_id,
          aiUserId: AI_USER_ID,
        },
        user._id,
      );
      await this.audioClipsService.processAllClipsInDB(audioDescriptionId.audioDescriptionId.toString());
      res.status(201).json({
        message: `Successfully created new user Audio Description`,
        url: `${newUserAudioDescription.youtube_id}/${audioDescriptionId.audioDescriptionId.toString()}`,
      });
    } catch (error) {
      next(error);
    }
  };

  public saveVisitedVideosHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const youtubeId = req.body.youtube_id;
      const invalidate_cache = req.body.invalidate_cache;
      if (!userData) {
        throw new Error('User not logged in');
      }
      const user = await MongoUsersModel.findById(userData._id);
      if (!user) {
        throw new Error('User not found');
      }
      const response = await this.userService.saveVisitedVideosHistory(user._id, youtubeId, invalidate_cache);

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public getVisitedVideosHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const pageNumber = req.query.page;
      const paginate = req.query.paginate !== 'false';
      if (!userData) {
        throw new Error('User not logged in');
      }
      const user = await MongoUsersModel.findById(userData._id);
      if (!user) {
        throw new Error('User not found');
      }

      const response = await this.userService.getVisitedVideosHistory(user._id, <string>pageNumber, paginate);

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  public processAllClipsInDBController = async (req: Request, res: Response, next: NextFunction) => {
    const ad_id = req.params.ad_id;
    if (!ad_id) {
      throw new Error('No Audio Description ID provided');
    }
    try {
      const response = await this.audioClipsService.processAllClipsInDB(ad_id);
      return res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };

  public handlePipelineFailure = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const failureData: PipelineFailureDto = req.body;
      await this.userService.handlePipelineFailure(failureData);
      res.status(200).json({ message: 'Pipeline failure handled successfully' });
    } catch (error) {
      next(error);
    }
  };

  public infoBotGenerateAnswer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const requestBody: InfoBotRequestDto = req.body;
      const response = await this.userService.infoBotGenerateAnswer(requestBody);
      res.status(200).json(response);
    } catch (error) {
      next(error);
    }
  };
}

export default UsersController;
