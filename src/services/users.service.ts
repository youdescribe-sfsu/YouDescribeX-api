import { CreateUserDto } from '../dtos/users.dto';
import { HttpException } from '../exceptions/HttpException';
import { IUsers } from '../interfaces/users.interface';
import { isEmpty } from '../utils/util';
import { CURRENT_DATABASE } from '../config';
import { User as mongodbUser } from '../models/mongodb/User.mongo.model';
import { UsersSchema as postgresUser } from '../models/postgres/Users.postgres.model';
class UserService {
  public async findAllUser(): Promise<IUsers[]> {
    const users: IUsers[] = await mongodbUser.find();
    return users;
  }

  public async findUserByEmail(userEmail: string): Promise<IUsers> {
    if (isEmpty(userEmail)) throw new HttpException(400, 'UserId is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findUserByEmail: IUsers = await mongodbUser.findOne({ user_email: userEmail });
      if (!findUserByEmail) throw new HttpException(409, "User doesn't exist");
      return findUserByEmail;
    } else {
      const findUserByEmail = await postgresUser.findOne({ where: { user_email: userEmail } });
      if (!findUserByEmail) throw new HttpException(409, "User doesn't exist");
      return findUserByEmail;
    }
  }

  public async createUser(userData: CreateUserDto): Promise<IUsers> {
    if (isEmpty(userData)) throw new HttpException(400, 'userData is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const findUser: IUsers = await mongodbUser.findOne({ user_email: userData.email });
      if (findUser) throw new HttpException(409, `This email ${userData.email} already exists`);
      const createUserData: IUsers = await mongodbUser.create({
        is_ai: false,
        name: userData.name,
        user_email: userData.email,
      });

      return createUserData;
    } else {
      const findUser = await postgresUser.findOne({ where: { user_email: userData.email } });
      if (findUser) throw new HttpException(409, `This email ${userData.email} already exists`);
      const createUserData = await postgresUser.create({
        is_ai: false,
        name: userData.name,
        user_email: userData.email,
      });
      return createUserData;
    }
  }

  public async deleteUser(userEmail: string): Promise<IUsers> {
    if (isEmpty(userEmail)) throw new HttpException(400, 'UserEmail is empty');

    if (CURRENT_DATABASE == 'mongodb') {
      const deleteUserByEmail: IUsers = await mongodbUser.findOneAndDelete({ user_email: userEmail });
      if (!deleteUserByEmail) throw new HttpException(409, "User doesn't exist");
      return deleteUserByEmail;
    } else {
      const deleteUserByEmail = await postgresUser.findOne({ where: { user_email: userEmail } });
      if (!deleteUserByEmail) throw new HttpException(409, "User doesn't exist");
      await postgresUser.destroy({ where: { user_email: userEmail } });
      return deleteUserByEmail;
    }
  }
}

export default UserService;
