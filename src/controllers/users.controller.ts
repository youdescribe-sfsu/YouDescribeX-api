import { NextFunction, Request, Response } from 'express';
import { CreateUserAudioDescriptionDto, CreateUserDto } from '../dtos/users.dto';
import { IUsers } from '../interfaces/users.interface';
import userService from '../services/users.service';

class UsersController {
  public userService = new userService();
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
