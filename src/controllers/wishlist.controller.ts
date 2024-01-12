import { NextFunction, Request, Response } from 'express';
import WishListService from '../services/wishlist.service';
import { WishListRequest } from '../dtos/wishlist.dto';
import { IUser } from '../models/mongodb/User.mongo';
import { MongoUsersModel } from '../models/mongodb/init-models.mongo';

class WishListController {
  public wishlistService = new WishListService();

  public getAllWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const filterBody: WishListRequest = req.body;
      const wishlistResponse = await this.wishlistService.getAllWishlist(filterBody);
      res.status(201).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };

  public getUserWishlist = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const pageNumber = req.query.pageNumber as string;
      if (!userData) {
        throw new Error('User not logged in');
      }
      const user = await MongoUsersModel.findById(userData._id);
      if (!user) {
        throw new Error('User not found');
      }
      const wishlistResponse = await this.wishlistService.getUserWishlist(user._id, pageNumber);
      res.status(201).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };

  public addOneWishlistItem = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      // console.log(req.body);

      const { youTubeId } = req.body;
      if (!userData) {
        throw new Error('User not logged in');
      }
      const user = await MongoUsersModel.findById(userData._id);
      if (!user) {
        throw new Error('User not found');
      }

      if (!youTubeId) {
        throw new Error('YouTube ID not provided');
      }

      const wishlistResponse = await this.wishlistService.addOneWishlistItem(youTubeId, user);
      res.status(201).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };

  public getTopWishListItems = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req?.user as unknown as IUser;
      const wishlistResponse = await this.wishlistService.getTopWishListItems(userData);
      res.status(wishlistResponse.status).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };

  public getTopWishList = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userData = req.user as unknown as IUser;
      const wishlistResponse = await this.wishlistService.getTopWishlist(userData?._id);
      res.status(201).json(wishlistResponse);
    } catch (error) {
      next(error);
    }
  };

  public removeOne = async (req: Request, res: Response) => {
    const userId: string = req.body.userId;
    const youTubeId: string = req.body.youTubeId;

    const result = await this.wishlistService.removeOne(userId, youTubeId);

    return res.status(result.status).json({ message: result.message });
  };
}

export default WishListController;
